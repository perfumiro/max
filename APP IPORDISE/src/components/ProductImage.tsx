import React, { useState } from 'react';
import { Image, View, Text, type ImageProps, type ImageSourcePropType } from 'react-native';

type Props = ImageProps & { fallbackSources?: ImageSourcePropType[] };

function ImageAttempt({ source, fallbackSources = [], onError, ...props }: Props) {
  const [attempt, setAttempt] = useState(0);
  const sources = [source, ...fallbackSources];
  const current = sources[attempt];
  if (!current) return <View accessibilityLabel="Product photo unavailable" style={[props.style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f4ef' }]}><Text style={{ color: '#71665e', fontSize: 12 }}>Photo unavailable</Text></View>;
  return <Image {...props} source={current} onError={event => { setAttempt(value => value + 1); onError?.(event); }} />;
}

/** A changed product/source resets failures, including after a catalog refresh. */
export function ProductImage(props: Props) {
  return <ImageAttempt key={JSON.stringify([props.source, props.fallbackSources])} {...props} />;
}
