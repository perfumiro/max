const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const completedUploads = new WeakMap();

// Keep transparency; only resize large camera images, leaving small files intact.
export async function prepareProductImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP product image.');
  }
  if (!file.size) throw new Error('This image is empty. Please choose another image.');
  let prepared = file;
  if (file.size > 1024 * 1024) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, file.type, 0.85));
        if (blob && blob.size < file.size) {
          prepared = new File([blob], file.name, { type: blob.type });
        }
      }
    } catch (_) {
      // If this browser cannot decode the image, the original may still upload.
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new Error('This image is too large. Choose an image smaller than 10 MB.');
  }
  return prepared;
}

export async function uploadProductImage(file, { cloud, preset, progress } = {}) {
  if (completedUploads.has(file)) {
    progress?.(100);
    return completedUploads.get(file);
  }
  const prepared = await prepareProductImage(file);
  progress?.(0);
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const body = new FormData();
      body.append('file', prepared);
      body.append('upload_preset', preset);
      // Let the browser set multipart headers; upload event listeners can force
      // an unnecessary cross-origin preflight on mobile browsers.
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: 'POST', body, signal: controller.signal, credentials: 'omit',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.secure_url?.startsWith('https://')) {
        const error = new Error(payload.error?.message || `Image upload failed (${response.status}).`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      completedUploads.set(file, payload.secure_url);
      progress?.(100);
      return payload.secure_url;
    } catch (error) {
      const networkFailure = error.name === 'TypeError' || error.name === 'AbortError';
      if (!networkFailure && !error.retryable) throw error;
      if (attempt === 2) {
        if (!networkFailure) throw error;
        throw new Error('Could not reach the image service after 3 attempts. Your form is still here. Check your connection or try another network, then save again.');
      }
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
