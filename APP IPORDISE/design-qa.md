# IPORDISE customer support screen — design QA

## Reference and capture

- Reference: user-provided 457 × 821 mobile support-screen image in the current conversation.
- Implementation capture: `design-qa/support-screen-457x821.png`.
- Route/state: `/app?store=1&tab=help&destination=contact&skipIntro=1`, new-conversation state.
- Browser capture: Chrome headless, device scale factor 1. Chrome enforces a 500 CSS-pixel minimum headless viewport, so the 457-pixel output crops the rightmost 43 pixels; spacing and scale were judged against the visible 457-pixel region and the responsive mobile rules.

## Visual comparison

- Header hierarchy matches: rounded ivory card, circular back action, centered IPORDISE signature, secure shield, red eyebrow, serif headline, and muted support copy.
- Form hierarchy matches: burgundy conversation icon, editorial heading, three topic controls, two-up customer details, order field, large message field, full-width red CTA, and centered privacy note.
- Vertical rhythm matches the reference closely: header begins at 22px, conversation card begins at 211px, and the form card ends at approximately 651px.
- Bottom navigation remains fixed and the Help tab remains selected. Labels localize from the active app language; the reference's English labels are available when English is selected.
- No extra WhatsApp, email, or phone cards interrupt the primary secure-message flow.

## Functional checks

- Topic controls retain selected-state semantics and update the support subject.
- Name, email, optional order number, and multiline message inputs remain editable and keyboard-safe.
- Submit remains connected to `createSupportConversation`; the saved customer session, 20-second dashboard refresh, staff replies, reply composer, and new-conversation action are unchanged.
- Preview-only `skipIntro=1` bypasses the launch animation for deterministic QA and does not change the normal app launch.
- `npx tsc --noEmit`: passed.
- `npm run build:web`: passed.

final result: passed
