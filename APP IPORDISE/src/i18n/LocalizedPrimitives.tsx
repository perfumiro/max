import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextInput, type TextInputProps, type TextProps } from 'react-native';
import { useLanguage } from './LanguageContext';
import { translateSiteText } from './siteTranslations';

function translateChildren(children: React.ReactNode, language: 'fr' | 'ar' | 'en'): React.ReactNode {
  if (typeof children === 'string') return translateSiteText(children, language);
  if (Array.isArray(children)) return children.map((child, index) => <React.Fragment key={index}>{translateChildren(child, language)}</React.Fragment>);
  return children;
}

export function LocalizedText({ children, ...props }: TextProps) {
  const { language } = useLanguage();
  return <NativeText {...props}>{translateChildren(children, language)}</NativeText>;
}

export const LocalizedTextInput = React.forwardRef<TextInput, TextInputProps>(function LocalizedTextInput(props, ref) {
  const { language } = useLanguage();
  const placeholder = typeof props.placeholder === 'string' ? translateSiteText(props.placeholder, language) : props.placeholder;
  const accessibilityLabel = typeof props.accessibilityLabel === 'string' ? translateSiteText(props.accessibilityLabel, language) : props.accessibilityLabel;
  const accessibilityHint = typeof props.accessibilityHint === 'string' ? translateSiteText(props.accessibilityHint, language) : props.accessibilityHint;
  return <NativeTextInput ref={ref} {...props} placeholder={placeholder} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} />;
});
