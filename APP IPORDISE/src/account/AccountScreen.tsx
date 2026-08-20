import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useBagSnapshot, useFavouriteSnapshot } from "../commerce/ShoppingContext";
import { appConfig } from "../config";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../i18n/LocalizedPrimitives";
import { useLanguage, type AppLanguage } from "../i18n/LanguageContext";
import { useResponsiveLayout } from "../useResponsiveLayout";
import { popPreviousNavigationEntry, recordNavigationEntry, registerAndroidBackAction } from "../navigation/androidBackNavigation";
import {
  deleteCustomerAddress,
  deleteCustomerAccount,
  requestDataExport,
  saveCustomerAddress,
  type CustomerAddress,
  type CustomerOrderSummary,
  type CustomerProfile,
} from "../services/customerAccountService";
import {
  CustomerAuthError,
  requestCustomerPasswordReset,
  resendCustomerVerification,
  updateCustomerPassword,
} from "../services/customerAuthService";
import {
  isStrongPassword,
  isValidEmail,
  isValidMoroccanPhone,
  normalizeEmail,
} from "../services/customerValidation";
import { useCustomerAuth } from "./CustomerAuthContext";
import { useCustomer } from "./CustomerContext";
import { uploadCustomerAvatar, type PendingCustomerAvatar } from "../services/customerAvatarService";
import { usePushNotifications } from "../notifications/PushNotificationProvider";

const RED = "#e63946";
const INK = "#0f0a0a";
const GREEN = "#2d6a4f";
const DARK_CREAM = "#f0ebe7";
const WARM_BROWN = "#6b5b4f";
const LIGHT_GRAY = "#e8e0da";
const retryableAuthCodes = new Set(["network", "timeout", "unavailable"]);
const authErrorMessage = (error: unknown, t: (key: string) => string) =>
  error instanceof CustomerAuthError ? t(`authError_${error.code}`) : t("authError_generic");
type AuthMode = "welcome" | "signin" | "signup" | "forgot" | "verify" | "reset";
type AccountPage =
  | "home"
  | "orders"
  | "order-details"
  | "profile"
  | "addresses"
  | "language"
  | "notifications"
  | "privacy"
  | "legal";
type AddressPageHandle = { requestBack: () => boolean };

function BrandHeader({
  title,
  onBack,
}: {
  title?: string;
  onBack?: () => void;
}) {
  const { t, rtl } = useLanguage();
  const layout = useResponsiveLayout();
  return (
    <View style={[s.header, !layout.tablet && s.headerPhone, rtl && s.rtlDirection]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={onBack}
          style={({pressed, hovered, focused}: any) => [s.iconButton, hovered && s.surfaceHover, focused && s.focusRing, pressed && s.pressed]}
        >
          <Ionicons
            name={rtl ? "arrow-forward" : "arrow-back"}
            size={20}
            color={INK}
          />
        </Pressable>
      ) : !layout.tablet ? (
        <View style={s.headerLanguage}><LanguageSwitcher compact header /></View>
      ) : (
        <View style={s.headerSide} />
      )}
      <View style={s.headerBrand}>
        <Text style={s.brand}>IPORDISE</Text>
        {!title ? <View style={s.brandAccent} /> : null}
        {title ? <Text style={s.headerTitle}>{title}</Text> : null}
      </View>
      {!layout.tablet && !onBack ? (
        <View accessibilityLabel={`${t("currency")}: MAD. ${t("privateAccount")}`} style={s.headerMarket}>
          <Text style={s.headerMarketText}>MAD</Text>
          <View style={s.headerMarketDivider} />
          <Ionicons name="lock-closed-outline" size={12} color={GREEN} />
        </View>
      ) : (
        <View accessibilityLabel={t("privateAccount")} style={[s.secure, !layout.tablet && s.securePhone]}>
          <Ionicons name="lock-closed-outline" size={14} color={GREEN} />
          {layout.tablet ? <Text style={s.secureText}>{t("private")}</Text> : null}
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType = "default",
  error,
  autoCapitalize = "sentences",
  editable = true,
  autoComplete,
  textContentType,
  onBlur,
  returnKeyType,
}: any) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldGroup}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[
          s.field,
          !editable && { backgroundColor: "#f5f1ef" },
          focused && s.fieldFocused,
          error && s.fieldError,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9a8f89"
          secureTextEntry={secure && !visible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          style={s.input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? t("hidePassword") : t("showPassword")}
            onPress={() => setVisible((x) => !x)}
            style={s.fieldAction}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={19}
              color="#776d67"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon = "arrow-forward",
  compact = false,
}: any) {
  const { t, rtl } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered, focused }: any) => [
        s.primary,
        compact && s.primaryCompact,
        (disabled || loading) && s.disabled,
        hovered && !disabled && !loading && s.primaryHover,
        focused && s.focusRing,
        pressed && s.pressed,
      ]}
    >
      <Text style={s.primaryText}>
        {loading ? t("pleaseWait") : label}
      </Text>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={[s.primaryIcon, compact && s.primaryIconCompact]}>
          <Ionicons name={rtl && icon === "arrow-forward" ? "arrow-back" : icon} size={19} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

const LanguageSwitcher = memo(function LanguageSwitcher({ labelled = false, compact = false, header = false }: { labelled?: boolean; compact?: boolean; header?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <View style={[s.preferenceControl, labelled && s.preferenceControlWide, compact && s.preferenceLanguageCompact, header && s.preferenceLanguageHeader]}>
      {labelled ? <Text style={s.preferenceLabel}>{t("language")}</Text> : null}
      <View accessibilityRole="radiogroup" style={[s.languageSwitcher, header && s.languageSwitcherHeader]}>
      {(
        [
          ["fr", "FR"],
          ["en", "EN"],
        ] as const
      ).map(([code, label]) => (
        <Pressable
          key={code}
          accessibilityRole="radio"
          accessibilityLabel={code === "fr" ? "Français" : "English"}
          accessibilityState={{ checked: language === code }}
          {...(Platform.OS === "web"
            ? ({ "aria-checked": language === code } as any)
            : {})}
          onPress={() => void setLanguage(code)}
          style={({pressed, hovered, focused}: any) => [
            s.languageChoice,
            language === code && s.languageChoiceActive,
            header && s.languageChoiceHeader,
            header && language === code && s.languageChoiceHeaderActive,
            hovered && language !== code && s.surfaceHover,
            focused && s.focusRing,
            pressed && s.pressed,
          ]}
        >
          <Text
            style={[
              s.languageChoiceText,
              language === code && s.languageChoiceTextActive,
              header && language === code && s.languageChoiceTextHeaderActive,
            ]}
          >
            {label}
          </Text>
          {header && language === code ? <View style={s.languageHeaderIndicator} /> : null}
        </Pressable>
      ))}
      </View>
    </View>
  );
});

function PreferenceBar() {
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  return (
    <View style={[s.preferenceBar, !layout.tablet && s.preferenceBarCompact]}>
      <LanguageSwitcher labelled={layout.tablet} compact={!layout.tablet} />
      <View accessibilityLabel={`${t("currency")}: MAD`} style={[s.preferenceControl, s.currencyControl, !layout.tablet && s.currencyControlCompact]}>
        {layout.tablet ? <Text style={s.preferenceLabel}>{t("currency")}</Text> : null}
        <View style={s.currencyValue}>
          <Text style={s.currencyText}>MAD</Text>
          <Ionicons name="checkmark-circle" size={layout.tablet ? 17 : 15} color={GREEN} />
        </View>
      </View>
    </View>
  );
}

function ConfirmationDialog({ visible, title, body, confirmLabel, cancelLabel, loading = false, danger = false, confirmDisabled = false, onConfirm, onCancel, children }: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View accessibilityViewIsModal {...(Platform.OS === "web" ? ({ "aria-modal": true } as any) : {})} style={s.dialogBackdrop}>
        <Pressable accessible={false} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityRole="alert" style={s.dialogCard}>
          <View style={[s.dialogIcon, danger && s.dialogDangerIcon]}><Ionicons name={danger ? "warning-outline" : "log-out-outline"} size={24} color={danger ? RED : INK} /></View>
          <Text style={s.dialogTitle}>{title}</Text>
          <Text style={s.dialogBody}>{body}</Text>
          {children}
          <View style={s.dialogActions}>
            <Pressable accessibilityRole="button" disabled={loading} onPress={onCancel} style={({pressed}) => [s.dialogCancel, pressed && s.pressed]}><Text style={s.dialogCancelText}>{cancelLabel}</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: confirmDisabled || loading, busy: loading }} disabled={confirmDisabled || loading} onPress={onConfirm} style={({pressed}) => [s.dialogConfirm, danger && s.dialogConfirmDanger, (confirmDisabled || loading) && s.disabled, pressed && s.pressed]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={s.dialogConfirmText}>{confirmLabel}</Text>}</Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const GuestQuickAction = memo(function GuestQuickAction({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, hovered, focused }: any) => [s.guestQuickAction, hovered && s.guestQuickActionHover, focused && s.focusRing, pressed && s.quickActionPressed]}
    >
      <View style={s.guestQuickIcon}><Ionicons name={icon} size={21} color={INK} /></View>
      <Text numberOfLines={2} style={s.guestQuickLabel}>{label}</Text>
      <Ionicons name="arrow-forward" size={14} color="#9a8f89" />
    </Pressable>
  );
});

const GuestBenefits = memo(function GuestBenefits({ onWishlist, onBag, onHelp }: {
  onWishlist: () => void;
  onBag: () => void;
  onHelp: () => void;
}) {
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  return (
    <View style={[s.benefitsSection, layout.compact && s.benefitsSectionCompact]}>
      <View style={s.benefitsHeading}>
        <Text style={s.eyebrow}>{t("memberBenefits")}</Text>
        <Text style={[s.benefitsTitle, layout.compact && s.benefitsTitleCompact]}>{t("memberBenefitsTitle")}</Text>
      </View>
      <View style={s.guestQuickActions}>
        <GuestQuickAction icon="heart-outline" label={t("wishlist")} onPress={onWishlist} />
        <GuestQuickAction icon="bag-handle-outline" label={t("cart")} onPress={onBag} />
        <GuestQuickAction icon="chatbubble-ellipses-outline" label={t("helpSection")} onPress={onHelp} />
      </View>
      <View style={s.privacyNote}>
        <Ionicons name="lock-closed-outline" size={17} color={GREEN} />
        <Text style={s.privacyNoteText}>{t("privacyNote")}</Text>
      </View>
    </View>
  );
});

function LoggedOutAccount({
  onShop,
  onWishlist,
  onBag,
  onHelp,
  bottomInset,
}: {
  onShop: (filter: string) => void;
  onWishlist: () => void;
  onBag: () => void;
  onHelp: () => void;
  bottomInset: number;
}) {
  const { signIn, signUp, authNotice, rememberIntendedDestination } = useCustomerAuth();
  const { rtl, t } = useLanguage();
  const layout = useResponsiveLayout();
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false, phone: false });
  const [cooldown, setCooldown] = useState(0);
  const requestInFlight = useRef(false);
  const lastAction = useRef<(() => Promise<void>) | null>(null);
  const authModeRef=useRef<AuthMode>('welcome');
  const authHistoryRef=useRef<AuthMode[]>([]);
  const navigateAuth=useCallback((next:AuthMode)=>{const current=authModeRef.current;if(!recordNavigationEntry(authHistoryRef.current,current,next))return;authModeRef.current=next;setMode(next);},[]);
  const goBackAuth=useCallback(()=>{const previous=popPreviousNavigationEntry(authHistoryRef.current,authModeRef.current)||'welcome';authModeRef.current=previous;setMode(previous);setError('');setMessage('');},[]);
  useEffect(()=>{if(Platform.OS==='web'||mode==='welcome')return;return registerAndroidBackAction(()=>{goBackAuth();return true;});},[goBackAuth,mode]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () => setCooldown((x) => Math.max(0, x - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);
  const emailError =
    touched.email && email && !isValidEmail(email)
      ? t("invalidEmail")
      : "";
  const passwordError =
    touched.password && mode === "signup" && password && !isStrongPassword(password)
      ? t("weakPasswordHelp")
      : "";
  const confirmError = touched.confirm && confirm && confirm !== password ? t("passwordMismatch") : "";
  const phoneError = touched.phone && phone && !isValidMoroccanPhone(phone) ? t("invalidPhone") : "";
  const run = async (action: () => Promise<void>) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    lastAction.current = action;
    setLoading(true);
    setError("");
    setErrorCode("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(authErrorMessage(e, t));
      setErrorCode(e instanceof CustomerAuthError ? e.code : "generic");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  };
  const submitSignIn = () => {
    setTouched(current => ({ ...current, email: true, password: true }));
    if (!isValidEmail(email) || !password) { setError(t("completeEmailPassword")); return; }
    void run(async () => {
      await signIn(normalizeEmail(email), password, remember);
    });
  };
  const submitSignUp = () => {
    setTouched({ email: true, password: true, confirm: true, phone: true });
    if (
        !firstName.trim() ||
        !lastName.trim() ||
        !isValidEmail(email) ||
        !isStrongPassword(password) ||
        password !== confirm ||
        (phone && !isValidMoroccanPhone(phone)) ||
        !terms
      ) { setError(t("reviewRequiredFields")); return; }
    void run(async () => {
      const result = await signUp({
        email,
        password,
        firstName,
        lastName,
        phone,
        marketingConsent: marketing,
      });
      if (result === "verify-email") {
        navigateAuth("verify");
        setCooldown(60);
      }
    });
  };
  const submitForgot = () => {
    setTouched(current => ({ ...current, email: true }));
    if (!isValidEmail(email)) { setError(t("invalidEmail")); return; }
    void run(async () => {
      await rememberIntendedDestination();
      await requestCustomerPasswordReset(email);
      setMessage(t("recoveryPrivacySuccess"));
      setCooldown(60);
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.flex}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 32 }]}
      >
        <View style={[s.content, Platform.OS === "web" && { width: Math.max(280, layout.width - 32) }, layout.tablet && s.contentWide, rtl && s.rtlDirection]}>
          <BrandHeader />
          {layout.tablet ? <PreferenceBar /> : null}
          <View style={[s.guestLead, layout.tablet && s.guestLeadWide]}>
          {mode === "welcome" ? <View style={[s.guestWelcome, layout.tablet && s.guestWelcomeWide]}>
            <View style={s.guestAvatar}><Ionicons name="person-outline" size={29} color={INK} /></View>
            <View style={s.guestWelcomeCopy}>
              <Text style={s.guestEyebrow}>{t("account")}</Text>
              <Text accessibilityRole="header" style={s.guestTitle}>{t("welcomeHome")}</Text>
              <Text style={s.guestDescription}>{t("authIntro")}</Text>
            </View>
          </View> : null}
          <View style={[s.authCard, !layout.tablet && s.authCardCompact, layout.tablet && s.authCardWide, !layout.tablet && mode!=="welcome" && s.authCardFormCompact]}>
            {mode === "welcome" ? null : <View style={s.authStatus}><Text style={s.eyebrow}>{t("memberAccess")}</Text></View>}
            {authNotice ? (
              <View accessibilityRole="alert" style={s.errorBox}>
                <View style={s.noticeIcon}><Ionicons name="information-circle-outline" size={17} color={RED} /></View>
                <Text style={s.errorBoxText}>{t(authNotice)}</Text>
              </View>
            ) : null}
            {mode === "welcome" ? (
              <>
                <PrimaryButton
                  label={t("signIn")}
                  onPress={() => navigateAuth("signin")}
                  compact={!layout.tablet}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t("authIntro")}
                  onPress={() => navigateAuth("signup")}
                  style={({pressed, hovered, focused}: any) => [s.secondary, !layout.tablet && s.secondaryCompact, hovered && s.surfaceHover, focused && s.focusRing, pressed && s.pressed]}
                >
                  <Text style={s.secondaryText}>{t("createAccount")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t("continueShopping")}
                  onPress={() => onShop("")}
                  style={({pressed}) => [s.textButton, pressed && s.textButtonPressed]}
                >
                  <Text style={s.textButtonText}>{t("continueShopping")}</Text>
                  <Ionicons name={rtl ? "arrow-back" : "arrow-forward"} size={14} color="#6d615b" />
                </Pressable>
              </>
            ) : null}
            {mode !== "welcome" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  goBackAuth();
                }}
                style={s.backLink}
              >
                <Ionicons
                  name={rtl ? "arrow-forward" : "arrow-back"}
                  size={15}
                  color={INK}
                />
                <Text style={s.backLinkText}>{t("back")}</Text>
              </Pressable>
            ) : null}
            {mode === "signin" ? (
              <>
                <Text style={s.eyebrow}>{t("welcomeBack")}</Text>
                <Text style={s.cardTitle}>{t("signInTitle")}</Text>
                <Field
                  label={t("email")}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onBlur={() => setTouched(current => ({ ...current, email: true }))}
                  error={emailError}
                />
                <Field
                  label={t("password")}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("passwordPlaceholder")}
                  secure
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onBlur={() => setTouched(current => ({ ...current, password: true }))}
                />
                <View style={s.optionRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: remember }}
                    {...(Platform.OS === 'web' ? ({ 'aria-checked': remember } as any) : {})}
                    onPress={() => setRemember((x) => !x)}
                    style={s.checkRow}
                  >
                    <View style={[s.checkbox, remember && s.checkboxOn]}>
                      {remember ? (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      ) : null}
                    </View>
                    <Text style={s.optionText}>{t("remember")}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => navigateAuth("forgot")} style={s.inlineLinkButton}>
                    <Text style={s.link}>{t("forgot")}</Text>
                  </Pressable>
                </View>
                <PrimaryButton
                  label={t("openAccount")}
                  onPress={submitSignIn}
                  loading={loading}
                  disabled={!!emailError || !email || !password}
                />
                <Text style={s.switchPrompt}>
                  {t("newMember")} ·{" "}
                  <Text onPress={() => navigateAuth("signup")} style={s.link}>
                    {t("createAccount")}
                  </Text>
                </Text>
              </>
            ) : null}
            {mode === "signup" ? (
              <>
                <Text style={s.eyebrow}>{t("newMember")}</Text>
                <Text style={s.cardTitle}>{t("signupTitle")}</Text>
                <View style={s.twoFields}>
                  <View style={s.half}>
                    <Field
                      label={t("firstName")}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder={t("firstName")}
                      autoComplete="given-name"
                      textContentType="givenName"
                    />
                  </View>
                  <View style={s.half}>
                    <Field
                      label={t("lastName")}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder={t("lastName")}
                      autoComplete="family-name"
                      textContentType="familyName"
                    />
                  </View>
                </View>
                <Field
                  label={t("email")}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  onBlur={() => setTouched(current => ({ ...current, email: true }))}
                  error={emailError}
                />
                <Field
                  label={t("phone")}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="06 12 34 56 78"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  onBlur={() => setTouched(current => ({ ...current, phone: true }))}
                  error={phoneError}
                />
                <Field
                  label={t("password")}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="12+"
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onBlur={() => setTouched(current => ({ ...current, password: true }))}
                  error={passwordError}
                />
                <Field
                  label={t("confirmPassword")}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder={t("confirmPassword")}
                  secure
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onBlur={() => setTouched(current => ({ ...current, confirm: true }))}
                  error={confirmError}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: terms }}
                  {...(Platform.OS === 'web' ? ({ 'aria-checked': terms } as any) : {})}
                  onPress={() => setTerms((x) => !x)}
                  style={s.checkRow}
                >
                  <View style={[s.checkbox, terms && s.checkboxOn]}>
                    {terms ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                  </View>
                  <Text style={s.optionText}>{t("terms")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marketing }}
                  {...(Platform.OS === 'web' ? ({ 'aria-checked': marketing } as any) : {})}
                  onPress={() => setMarketing((x) => !x)}
                  style={s.checkRow}
                >
                  <View style={[s.checkbox, marketing && s.checkboxOn]}>
                    {marketing ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                  </View>
                  <Text style={s.optionText}>{t("marketing")}</Text>
                </Pressable>
                <PrimaryButton
                  label={t("createAccount")}
                  onPress={submitSignUp}
                  loading={loading}
                  disabled={!terms || !!emailError || !!passwordError}
                />
              </>
            ) : null}
            {mode === "forgot" ? (
              <>
                <Text style={s.eyebrow}>{t("recovery")}</Text>
                <Text style={s.cardTitle}>{t("recoveryTitle")}</Text>
                <Text style={s.copy}>
                  We send a time-limited link when the address belongs to an
                  account.
                </Text>
                <Field
                  label={t("email")}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onBlur={() => setTouched(current => ({ ...current, email: true }))}
                  error={emailError}
                />
                <PrimaryButton
                  label={
                    cooldown ? `${t("retry")} ${cooldown}s` : t("sendLink")
                  }
                  onPress={submitForgot}
                  loading={loading}
                  disabled={!!cooldown || !!emailError}
                />
              </>
            ) : null}
            {mode === "verify" ? (
              <View style={s.centerState}>
                <View style={s.stateIcon}>
                  <Ionicons name="mail-outline" size={28} color={GREEN} />
                </View>
                <Text style={s.cardTitle}>{t("verifyTitle")}</Text>
                <Text style={s.copy}>{email}</Text>
                <PrimaryButton
                  label={cooldown ? `${t("resend")} ${cooldown}s` : t("resend")}
                  disabled={!!cooldown}
                  loading={loading}
                  onPress={() =>
                    run(async () => {
                      await resendCustomerVerification(email);
                      setCooldown(60);
                      setMessage(t("verificationSent"));
                    })
                  }
                />
                <Pressable
                  onPress={() => navigateAuth("signin")}
                  style={s.textButton}
                >
                  <Text style={s.textButtonText}>{t("signIn")}</Text>
                </Pressable>
              </View>
            ) : null}
            {mode === "reset" ? (
              <>
                <Text style={s.cardTitle}>
                  Choisissez un nouveau mot de passe.
                </Text>
                <Text style={s.copy}>
                  Open the secure recovery link from your email to continue.
                </Text>
              </>
            ) : null}
            {error ? (
              <View accessibilityRole="alert" style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={17} color={RED} />
                <Text style={s.errorBoxText}>{error}</Text>
                {retryableAuthCodes.has(errorCode) && lastAction.current ? <Pressable accessibilityRole="button" disabled={loading} onPress={() => lastAction.current && void run(lastAction.current)} style={s.inlineRetry}><Text style={s.inlineRetryText}>{t("retry")}</Text></Pressable> : null}
              </View>
            ) : null}
            {message ? (
              <View accessibilityRole="alert" style={s.successBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={17}
                  color={GREEN}
                />
                <Text style={s.successText}>{message}</Text>
              </View>
            ) : null}
          </View>
          </View>
          <GuestBenefits onWishlist={onWishlist} onBag={onBag} onHelp={onHelp} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MenuRow({ icon, title, subtitle, onPress, danger }: any) {
  const { rtl } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed, hovered, focused }: any) => [s.menuRow, hovered && s.surfaceHover, focused && s.focusRing, pressed && s.pressed]}
    >
      <View style={[s.menuIcon, danger && s.dangerIcon]}>
        <Ionicons name={icon} size={20} color={danger ? RED : INK} />
      </View>
      <View style={s.menuCopy}>
        <Text style={[s.menuTitle, danger && { color: RED }]}>{title}</Text>
        {subtitle ? <Text style={s.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={18} color="#8f837d" />
    </Pressable>
  );
}

function AccountSkeleton() {
  return (
    <View accessibilityLabel="Loading account overview" style={s.skeletonWrap}>
      <View style={[s.skeleton, s.skeletonTitle]} />
      <View style={[s.skeleton, s.skeletonOrder]} />
      <View style={[s.skeleton, s.skeletonRow]} />
      <View style={[s.skeleton, s.skeletonRow]} />
    </View>
  );
}

const RecentOrderCard = memo(function RecentOrderCard({
  order,
  language,
  onAllOrders,
  onTrack,
}: {
  order: CustomerOrderSummary;
  language: AppLanguage;
  onAllOrders: () => void;
  onTrack: () => void;
}) {
  const { t, rtl } = useLanguage();
  const item = order.items?.[0];
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-MA";
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(order.created_at));
  const total = new Intl.NumberFormat(locale, { style: "currency", currency: order.currency || "MAD", maximumFractionDigits: 0 }).format(order.total);
  return (
    <View style={s.recentOrder}>
      <View style={s.recentOrderHead}>
        <View><Text style={s.eyebrow}>{t("latestOrder")}</Text><Text style={s.recentOrderNumber}>{order.order_number}</Text></View>
        <View style={s.statusPill}><Text style={s.statusText}>{order.status.toUpperCase()}</Text></View>
      </View>
      <View style={s.recentOrderBody}>
        <View style={s.orderThumb}>
          {item?.image ? <Image accessibilityLabel={item.name || t("orderProduct")} source={{ uri: item.image }} resizeMode="contain" style={s.orderThumbImage} /> : <Ionicons name="bag-handle-outline" size={25} color={RED} />}
        </View>
        <View style={s.recentOrderCopy}>
          <Text numberOfLines={2} style={s.recentOrderName}>{item?.name || t("orderSummary")}</Text>
          <Text style={s.recentOrderMeta}>{date} · {total}</Text>
        </View>
      </View>
      <View style={s.orderActions}>
        <Pressable accessibilityRole="button" onPress={onTrack} style={({ pressed }) => [s.orderPrimaryAction, pressed && s.pressed]}>
          <Text style={s.orderPrimaryText}>{t("trackOrder")}</Text><Ionicons name={rtl ? "arrow-back" : "arrow-forward"} size={15} color="#fff" />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAllOrders} style={({ pressed }) => [s.orderSecondaryAction, pressed && s.pressed]}>
          <Text style={s.orderSecondaryText}>{t("allOrders")}</Text>
        </Pressable>
      </View>
    </View>
  );
});
function Stat({ value, label, icon, onPress }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={({ pressed, hovered, focused }: any) => [s.accountStat, hovered && s.quickActionHover, focused && s.focusRing, pressed && s.quickActionPressed]}
    >
      <View style={s.quickActionIcon}><Ionicons name={icon} size={21} color={INK} /></View>
      <Text style={s.accountStatValue}>{value}</Text>
      <Text style={s.accountStatLabel}>{label}</Text>
    </Pressable>
  );
}

function AccountInfoRow({
  icon,
  title,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  value: string;
}) {
  return (
    <View accessible accessibilityLabel={`${title}, ${value}`} style={s.infoRow}>
      <View style={s.menuIcon}><Ionicons name={icon} size={20} color={INK} /></View>
      <Text style={s.menuTitle}>{title}</Text>
      <Text style={s.infoRowValue}>{value}</Text>
    </View>
  );
}

function LoggedInAccount({
  onShop,
  onWishlist,
  onBag,
  onHelp,
  initialOrderId,
  onInitialOrderHandled,
  bottomInset,
}: {
  onShop: (filter: string) => void;
  onWishlist: () => void;
  onBag: () => void;
  onHelp: (destination?: "track") => void;
  initialOrderId?: string | null;
  onInitialOrderHandled?: () => void;
  bottomInset: number;
}) {
  const { session, signOut } = useCustomerAuth();
  const { favourites } = useFavouriteSnapshot();
  const { bagCount } = useBagSnapshot();
  const { language, setLanguage, rtl, t } = useLanguage();
  const push = usePushNotifications();
  const layout = useResponsiveLayout();
  const { profile, orders, addresses, preferences, loading, refreshing, error, unavailableSections, refresh: reload, refreshOrders, updateProfile, updatePreferences } = useCustomer();
  const [page, setPage] = useState<AccountPage>("home");
  const pageRef = useRef<AccountPage>("home");
  const pageHistoryRef = useRef<AccountPage[]>([]);
  const addressPageRef = useRef<AddressPageHandle>(null);
  const handledOrderLinkRef = useRef("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<CustomerProfile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [profileAttempted, setProfileAttempted] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState("");
  const [profileFeedbackError, setProfileFeedbackError] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<PendingCustomerAvatar | null>(null);
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const profilePageOpenRef = useRef(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const navigateAccount = useCallback((next: AccountPage) => {
    const current = pageRef.current;
    if (!recordNavigationEntry(pageHistoryRef.current, current, next)) return;
    pageRef.current = next;
    setPage(next);
  }, []);
  const commitAccountBack = useCallback(() => {
    const current = pageRef.current;
    const previous = popPreviousNavigationEntry(pageHistoryRef.current, current) || "home";
    pageRef.current = previous;
    setPage(previous);
    if (current === "order-details") setSelectedOrderId(null);
  }, []);
  useEffect(() => {
    if (!initialOrderId || loading || handledOrderLinkRef.current === initialOrderId) return;
    handledOrderLinkRef.current = initialOrderId;
    const order = orders.find(item => item.id === initialOrderId || item.order_number === initialOrderId);
    pageHistoryRef.current = order ? ["orders"] : [];
    setSelectedOrderId(order?.id || null);
    pageRef.current = order ? "order-details" : "orders";
    setPage(pageRef.current);
    onInitialOrderHandled?.();
  }, [initialOrderId, loading, onInitialOrderHandled, orders]);
  useEffect(() => {
    const entering = page === "profile" && !profilePageOpenRef.current;
    profilePageOpenRef.current = page === "profile";
    if (page !== "profile") return;
    if (entering) { setPendingAvatar(null); setProfileFeedback(""); setProfileFeedbackError(false); setProfileAttempted(false); }
    setProfileDraft(current => {
      const hasEditableData = Boolean(current?.first_name || current?.last_name || current?.display_name || current?.phone || current?.avatar_url);
      return entering || !hasEditableData ? profile || { user_id: session?.user.id || "" } : current;
    });
  }, [page, profile, session?.user.id]);
  useEffect(()=>{
    if(page!=="orders"||!session)return;
    void refreshOrders().catch(()=>undefined);
  },[page,refreshOrders,session]);
  const metadataFirstName = String(session?.user.user_metadata?.first_name || "").trim();
  const metadataLastName = String(session?.user.user_metadata?.last_name || "").trim();
  const rawName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    [metadataFirstName, metadataLastName].filter(Boolean).join(" ").trim() ||
    session?.user.email?.split("@")[0] ||
    "Member";
  const name = rawName.split(/\s+/).map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
  const avatarUrl = profile?.avatar_url || String(session?.user.user_metadata?.avatar_url || "");
  const draftAvatarUrl = profileDraft?.avatar_url === undefined ? avatarUrl : profileDraft.avatar_url || "";
  const editorAvatarUrl = pendingAvatar?.uri || draftAvatarUrl;
  const appVersion = Constants.expoConfig?.version || "0.0.1";
  const activeOrders = orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status),
  ).length;
  const selectedOrder = orders.find(order => order.id === selectedOrderId) || null;
  const profileUnavailable = unavailableSections.includes("profile");
  const ordersUnavailable = unavailableSections.includes("orders");
  const addressesUnavailable = unavailableSections.includes("addresses");
  const accountWarning = Boolean(error || unavailableSections.length);
  const profileCompletion = Math.round(([profile?.first_name, profile?.last_name, profile?.phone, addresses.length > 0].filter(Boolean).length / 4) * 100);
  const profileDirty = Boolean(pendingAvatar) || draftAvatarUrl !== avatarUrl || ["first_name", "last_name", "display_name", "phone"].some(key => String(profileDraft?.[key as keyof CustomerProfile] || "").trim() !== String(profile?.[key as keyof CustomerProfile] || "").trim());
  const requestAccountBack = useCallback(() => {
    if (pageRef.current === "addresses" && addressPageRef.current?.requestBack()) return true;
    if (pageRef.current === "profile" && profileDirty) {
      Alert.alert("Discard changes?", "Your unsaved profile changes will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: commitAccountBack },
      ]);
      return true;
    }
    commitAccountBack();
    return true;
  }, [commitAccountBack, profileDirty]);
  useEffect(()=>{if(Platform.OS==='web'||page==='home')return;return registerAndroidBackAction(requestAccountBack);},[page,requestAccountBack]);
  const firstNameError = profileAttempted && !profileDraft?.first_name?.trim() ? "Enter your first name." : "";
  const lastNameError = profileAttempted && !profileDraft?.last_name?.trim() ? "Enter your last name." : "";
  const profilePhoneError = profileAttempted && profileDraft?.phone && !isValidMoroccanPhone(profileDraft.phone) ? t("invalidPhone") : "";
  const chooseProfilePhoto = async () => {
    setProfileFeedback("");
    setProfileFeedbackError(false);
    setChoosingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setProfileFeedbackError(true); setProfileFeedback("Allow photo access in your phone settings to choose a profile picture."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.72, exif: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) { setProfileFeedbackError(true); setProfileFeedback("Choose a photo smaller than 5 MB."); return; }
      setAvatarFailed(false);
      setPendingAvatar({ uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize });
      setProfileDraft(current => ({ ...(current || { user_id: session?.user.id || "" }), avatar_url: current?.avatar_url || avatarUrl }));
      setProfileFeedback("Photo selected. Save changes to upload it.");
    } catch {
      setProfileFeedbackError(true);
      setProfileFeedback("We couldn't open your photo library. Try again.");
    } finally {
      setChoosingPhoto(false);
    }
  };
  const removeProfilePhoto = () => {
    setPendingAvatar(null);
    setAvatarFailed(false);
    setProfileDraft(current => ({ ...(current || { user_id: session?.user.id || "" }), avatar_url: "" }));
    setProfileFeedbackError(false);
    setProfileFeedback("Photo removed. Save changes to confirm.");
  };
  const saveProfile = async () => {
    if (!session || !profileDraft) return;
    setProfileAttempted(true);
    setProfileFeedback("");
    setProfileFeedbackError(false);
    if (!profileDraft.first_name?.trim() || !profileDraft.last_name?.trim() || (profileDraft.phone && !isValidMoroccanPhone(profileDraft.phone))) return;
    if (!profileDirty) return;
    setSaving(true);
    try {
      let avatar_url = draftAvatarUrl;
      if (pendingAvatar) avatar_url = await uploadCustomerAvatar(session.access_token, session.user.id, pendingAvatar);
      const saved = await updateProfile({ ...profileDraft, avatar_url });
      setProfileDraft(saved);
      setPendingAvatar(null);
      setProfileAttempted(false);
      setProfileFeedback("Profile updated");
    } catch (e) {
      setProfileFeedbackError(true);
      setProfileFeedback(e instanceof Error ? e.message : "We couldn't update your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const setLang = async (next: AppLanguage) => {
    await setLanguage(next);
    if (session)
      await updateProfile({
        locale: next === "ar" ? "ar-MA" : next === "en" ? "en-MA" : "fr-MA",
      }).catch(() => undefined);
  };
  const title =
    page === "home"
      ? undefined
      : (
          {
            orders: t("orders"),
            "order-details": "Order details",
            profile: t("profile"),
            addresses: t("addresses"),
            language: t("language"),
            notifications: t("notifications"),
            privacy: t("privacy"),
            legal: t("legal"),
          } as const
        )[page];
  if (!session) return null;
  return (
    <View style={s.flex}>
      <BrandHeader
        title={title}
        onBack={page === "home" ? undefined : requestAccountBack}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload(true)} tintColor={RED} colors={[RED]} />}
        contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 32 }]}
      >
        <View style={[s.content, Platform.OS === "web" && { width: Math.max(280, layout.width - 32) }, layout.tablet && s.contentWide, rtl && s.rtlDirection]}>
          {page === "home" ? (
            <>
              <View style={s.accountIdentity}>
                <View style={s.avatar}>
                  {avatarUrl && !avatarFailed ? <Image accessibilityLabel={name} source={{ uri: avatarUrl }} resizeMode="cover" onError={() => setAvatarFailed(true)} style={s.avatarImage} /> : <Text style={s.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>}
                </View>
                <View style={s.memberCopy}>
                  <Text style={s.accountIdentityLabel}>{t("account")}</Text>
                  <Text numberOfLines={2} style={s.accountIdentityName}>{name}</Text>
                  <View style={s.memberMetaRow}>
                    <View style={[s.verifiedDot, !session.user.email_confirmed_at && { backgroundColor: "#b68a48" }]} />
                    <Text style={s.verifiedText}>{session.user.email_confirmed_at ? t("verifiedAccount") : "Email not verified"}</Text>
                    <View style={s.memberMetaDivider} />
                    <Text numberOfLines={1} style={s.memberEmail}>{session.user.email}</Text>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t("editProfile")} onPress={() => navigateAccount("profile")} style={({pressed}) => [s.editProfileButton, pressed && s.pressed]}>
                  <Ionicons name="create-outline" size={19} color={INK} />
                </Pressable>
              </View>
              <Text style={s.sectionLabel}>{t("shopping")}</Text>
              <View style={s.quickActions}>
                <Stat
                  icon="cube-outline"
                  value={ordersUnavailable ? "—" : activeOrders}
                  label={t("orders")}
                  onPress={() => navigateAccount("orders")}
                />
                <View style={s.statDivider} />
                <Stat
                  icon="heart-outline"
                  value={favourites.length}
                  label={t("wishlist")}
                  onPress={onWishlist}
                />
                <View style={s.statDivider} />
                <Stat
                  icon="bag-handle-outline"
                  value={bagCount}
                  label={t("cart")}
                  onPress={onBag}
                />
              </View>
              {!loading && !profileUnavailable && !addressesUnavailable && profileCompletion < 100 ? <Pressable accessibilityRole="button" accessibilityLabel={`${t("completeProfile")}, ${profileCompletion}%`} onPress={() => navigateAccount("profile")} style={({pressed}) => [s.profileProgressCard, pressed && s.pressed]}><View style={s.profileProgressIcon}><Ionicons name="person-circle-outline" size={22} color={RED} /></View><View style={s.profileProgressCopy}><View style={s.profileProgressHeading}><Text style={s.profileProgressTitle}>{t("completeProfile")}</Text><Text style={s.profileProgressValue}>{profileCompletion}%</Text></View><View style={s.profileProgressTrack}><View style={[s.profileProgressFill, { width: `${profileCompletion}%` }]} /></View><Text style={s.profileProgressText}>{t("completeProfileCopy")}</Text></View><Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={17} color={INK} /></Pressable> : null}
              {loading ? <AccountSkeleton /> : null}
              {accountWarning ? (
                <View accessibilityRole="alert" style={s.accountError}>
                  <View style={s.accountErrorIcon}><Ionicons name="cloud-offline-outline" size={19} color="#8a5a25" /></View>
                  <View style={s.accountErrorCopy}><Text style={s.accountErrorTitle}>{t("accountUnavailable")}</Text><Text style={s.accountErrorText}>{t("accountUnavailableCopy")}</Text></View>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("retry")} onPress={() => void reload(true)} style={({pressed}) => [s.retryButton, pressed && s.pressed]}><Ionicons name="refresh" size={17} color={INK} /></Pressable>
                </View>
              ) : null}
              {!loading && !ordersUnavailable && orders[0] ? <RecentOrderCard order={orders[0]} language={language} onTrack={() => onHelp("track")} onAllOrders={() => navigateAccount("orders")} /> : null}
              {!loading && !ordersUnavailable && !orders.length ? <View style={s.noRecentOrder}><View style={s.noRecentIcon}><Ionicons name="cube-outline" size={24} color={RED} /></View><View style={s.noRecentCopy}><Text style={s.noRecentTitle}>{t("noRecentOrder")}</Text><Text style={s.menuSubtitle}>{t("noRecentOrderCopy")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t("discover")} onPress={() => onShop("")} style={s.noRecentAction}><Ionicons name={rtl ? "arrow-back" : "arrow-forward"} size={17} color={INK} /></Pressable></View> : null}
              <View style={s.hiddenShoppingMenu}>
                <MenuRow
                  icon="cube-outline"
                  title={t("orders")}
                  subtitle={ordersUnavailable ? "—" : orders.length === 1 ? t("oneOrder") : t("orderCount").replace("{count}", String(orders.length))}
                  onPress={() => navigateAccount("orders")}
                />
                <MenuRow
                  icon="heart-outline"
                  title={t("wishlist")}
                  subtitle={`${favourites.length}`}
                  onPress={onWishlist}
                />
                <MenuRow
                  icon="bag-handle-outline"
                  title={t("cart")}
                  subtitle={`${bagCount}`}
                  onPress={onBag}
                />
              </View>
              <Text style={s.sectionLabel}>{t("myAccount")}</Text>
              <View style={s.menuCard}>
                <MenuRow
                  icon="person-outline"
                  title={t("profile")}
                  onPress={() => navigateAccount("profile")}
                />
                <MenuRow
                  icon="location-outline"
                  title={t("addresses")}
                  subtitle={addressesUnavailable ? "—" : `${addresses.length}`}
                  onPress={() => navigateAccount("addresses")}
                />
              </View>
              <Text style={s.sectionLabel}>{t("languageCurrency")}</Text>
              <View style={s.menuCard}>
                <MenuRow
                  icon="language-outline"
                  title={t("appLanguage")}
                  subtitle={
                    language === "fr"
                      ? "Français · MAD"
                      : language === "ar"
                        ? "العربية · MAD"
                        : "English · MAD"
                  }
                  onPress={() => navigateAccount("language")}
                />
                <MenuRow
                  icon="notifications-outline"
                  title={t("notifications")}
                  onPress={() => navigateAccount("notifications")}
                />
              </View>
              <Text style={s.sectionLabel}>{t("privacy")}</Text>
              <View style={s.menuCard}>
                <MenuRow
                  icon="lock-closed-outline"
                  title={t("privacySecurity")}
                  onPress={() => navigateAccount("privacy")}
                />
              </View>
              <Text style={s.sectionLabel}>{t("helpSection")}</Text>
              <View style={s.menuCard}>
                <MenuRow
                  icon="chatbubble-ellipses-outline"
                  title={t("customerCare")}
                  subtitle={t("customerCareCopy")}
                  onPress={() => onHelp()}
                />
              </View>
              <Text style={s.sectionLabel}>{t("legal")}</Text>
              <View style={s.menuCard}>
                <MenuRow
                  icon="document-text-outline"
                  title={t("legal")}
                  onPress={() => navigateAccount("legal")}
                />
                <AccountInfoRow icon="information-circle-outline" title="IPORDISE" value={`v${appVersion}`} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setLogoutDialog(true)}
                style={s.signOut}
              >
                <Ionicons name="log-out-outline" size={18} color={RED} />
                <Text style={s.signOutText}>{t("signOut")}</Text>
              </Pressable>
              <ConfirmationDialog visible={logoutDialog} title={t("logoutTitle")} body={t("logoutBody")} confirmLabel={t("signOut")} cancelLabel={t("cancel")} loading={logoutLoading} onCancel={() => { if (!logoutLoading) setLogoutDialog(false); }} onConfirm={() => { if (logoutLoading) return; setLogoutLoading(true); void signOut().finally(() => { setLogoutLoading(false); setLogoutDialog(false); }); }} />
            </>
          ) : null}
          {page === "orders" ? (
            <View>
              <Text style={s.pageHeading}>{t("orders")}</Text>
              {orders.length ? (
                orders.map((order) => (
                  <Pressable accessibilityRole="button" accessibilityLabel={`View order ${order.order_number}`} key={order.id} onPress={() => { setSelectedOrderId(order.id); navigateAccount("order-details"); }} style={({pressed}) => [s.orderCard, pressed && s.pressed]}>
                    <View>
                      <Text style={s.orderNumber}>{order.order_number}</Text>
                      <Text style={s.menuSubtitle}>
                        {new Date(order.created_at).toLocaleDateString(
                          language,
                        )}{" "}
                        · {order.total} {order.currency}
                      </Text>
                    </View>
                    <View style={s.statusPill}>
                      <Text style={s.statusText}>
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                    <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={18} color="#7f746e" />
                  </Pressable>
                ))
              ) : (
                <View style={s.emptyState}>
                  <Ionicons name="cube-outline" size={34} color="#9b8e87" />
                  <Text style={s.cardTitle}>{t("noOrders")}</Text>
                  <PrimaryButton
                    label={t("discover")}
                    onPress={() => onShop("")}
                  />
                </View>
              )}
            </View>
          ) : null}
          {page === "order-details" && selectedOrder ? (
            <View>
              <Text style={s.pageHeading}>Order details</Text>
              <View style={s.orderDetailHero}>
                <View><Text style={s.orderDetailEyebrow}>ORDER NUMBER</Text><Text style={s.orderDetailNumber}>{selectedOrder.order_number}</Text><Text style={s.menuSubtitle}>{new Date(selectedOrder.created_at).toLocaleDateString(language, { day: "2-digit", month: "short", year: "numeric" })}</Text></View>
                <View style={s.statusPill}><Text style={s.statusText}>{selectedOrder.status.replaceAll("_", " ").toUpperCase()}</Text></View>
              </View>
              <View style={s.orderDetailPanel}>
                <Text style={s.sectionLabel}>PROGRESS</Text>
                {(["pending", "confirmed", "processing", "preparing", "shipped", "out_for_delivery", "delivered"] as const).map((status,index,list) => {
                  const currentIndex=Math.max(0,list.indexOf(selectedOrder.status as typeof status));
                  const complete=index<=currentIndex&&!['cancelled','refunded'].includes(selectedOrder.status);
                  return <View key={status} style={s.timelineRow}><View style={s.timelineRail}><View style={[s.timelineDot,complete&&s.timelineDotComplete]}>{complete?<Ionicons name="checkmark" size={11} color="#fff"/>:null}</View>{index<list.length-1?<View style={[s.timelineLine,index<currentIndex&&s.timelineLineComplete]}/>:null}</View><View style={s.timelineCopy}><Text style={[s.timelineTitle,complete&&s.timelineTitleComplete]}>{status.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())}</Text>{index===currentIndex?<Text style={s.timelineCurrent}>CURRENT STATUS</Text>:null}</View></View>;
                })}
              </View>
              <View style={s.orderDetailPanel}>
                <Text style={s.sectionLabel}>ITEMS</Text>
                {(selectedOrder.items || []).map((item,index)=><View key={`${item.productId||item.name}-${index}`} style={s.orderItemRow}>{item.image?<Image source={{uri:item.image,cache:'force-cache'}} resizeMode="contain" style={s.orderItemImage}/>:<View style={s.orderItemImagePlaceholder}><Ionicons name="flask-outline" size={20} color={RED}/></View>}<View style={s.menuCopy}><Text style={s.menuTitle}>{item.name || "IPORDISE fragrance"}</Text><Text style={s.menuSubtitle}>{item.size || ""} · Qty {item.quantity || 1}</Text></View><Text style={s.orderItemPrice}>{Number(item.lineTotal || item.unitPrice || 0).toLocaleString()} {selectedOrder.currency}</Text></View>)}
              </View>
              <View style={s.orderDetailPanel}>
                <Text style={s.sectionLabel}>DELIVERY & PAYMENT</Text>
                <AccountInfoRow icon="location-outline" title="Delivery address" value={String(selectedOrder.shipping_address?.addressLine1 || selectedOrder.customer?.address || "—")} />
                <AccountInfoRow icon="call-outline" title="Contact" value={String(selectedOrder.customer_snapshot?.phone || selectedOrder.customer?.phone || "—")} />
                <AccountInfoRow icon="cash-outline" title="Payment" value={String(selectedOrder.payment_method || "Cash on delivery")} />
                {selectedOrder.tracking_number?<><AccountInfoRow icon="navigate-outline" title="Tracking number" value={selectedOrder.tracking_number}/>{selectedOrder.tracking_url?<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(selectedOrder.tracking_url!)} style={s.trackButton}><Text style={s.trackButtonText}>TRACK ORDER</Text><Ionicons name="open-outline" size={15} color="#fff"/></Pressable>:null}</>:null}
              </View>
              <View style={s.orderTotals}><View style={s.orderTotalRow}><Text style={s.menuSubtitle}>Subtotal</Text><Text style={s.orderTotalValue}>{Number(selectedOrder.subtotal || 0).toLocaleString()} {selectedOrder.currency}</Text></View><View style={s.orderTotalRow}><Text style={s.menuSubtitle}>Delivery</Text><Text style={s.orderTotalValue}>{Number(selectedOrder.delivery_fee || 0).toLocaleString()} {selectedOrder.currency}</Text></View>{Number(selectedOrder.discount||0)>0?<View style={s.orderTotalRow}><Text style={s.menuSubtitle}>Discount</Text><Text style={s.orderTotalValue}>−{Number(selectedOrder.discount).toLocaleString()} {selectedOrder.currency}</Text></View>:null}<View style={[s.orderTotalRow,s.orderTotalFinal]}><Text style={s.cardTitle}>Total</Text><Text style={s.orderGrandTotal}>{Number(selectedOrder.total).toLocaleString()} {selectedOrder.currency}</Text></View></View>
              <PrimaryButton label="HELP WITH THIS ORDER" icon="chatbubble-ellipses-outline" onPress={() => onHelp("track")} />
            </View>
          ) : null}
          {page === "profile" ? (
            <View>
              <Text style={s.pageHeading}>Vos informations</Text>
              <Text style={s.copy}>
                Gardez vos coordonnées à jour pour une livraison plus simple.
              </Text>
              <View style={[s.profileEditorHero, layout.compact && s.profileEditorHeroCompact]}>
                <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" disabled={choosingPhoto || saving} onPress={() => void chooseProfilePhoto()} style={({pressed}) => [s.profilePhotoButton, (choosingPhoto || saving) && s.controlDisabled, pressed && s.pressed]}>
                  <View style={s.profileEditorAvatar}>{editorAvatarUrl && !avatarFailed ? <Image accessibilityLabel={name} source={{uri:editorAvatarUrl}} resizeMode="cover" onError={() => setAvatarFailed(true)} style={s.avatarImage} /> : <Text style={s.avatarText}>{name.slice(0,1).toUpperCase()}</Text>}</View>
                  <View style={s.profilePhotoBadge}>{choosingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}</View>
                </Pressable>
                <View style={s.profileEditorCopy}>
                  <Text style={s.profileEditorEyebrow}>PROFILE PHOTO</Text>
                  <Text style={s.profileEditorTitle}>Make your account personal.</Text>
                  <Text style={s.profileEditorText}>Choose a clear square photo. JPG, PNG or WEBP, up to 5 MB.</Text>
                  <View style={s.profilePhotoActions}>
                    <Pressable accessibilityRole="button" disabled={choosingPhoto || saving} onPress={() => void chooseProfilePhoto()} style={({pressed}) => [s.choosePhotoAction, (choosingPhoto || saving) && s.controlDisabled, pressed && s.pressed]}><Text style={s.choosePhotoText}>{choosingPhoto ? "OPENING PHOTOS" : pendingAvatar ? "CHOOSE ANOTHER" : "UPLOAD PHOTO"}</Text><Ionicons name="images-outline" size={14} color={RED}/></Pressable>
                    {editorAvatarUrl ? <Pressable accessibilityRole="button" accessibilityLabel="Remove profile photo" disabled={choosingPhoto || saving} onPress={removeProfilePhoto} style={({pressed}) => [s.removePhotoAction, (choosingPhoto || saving) && s.controlDisabled, pressed && s.pressed]}><Ionicons name="trash-outline" size={13} color="#756963"/><Text style={s.removePhotoText}>REMOVE</Text></Pressable> : null}
                  </View>
                </View>
              </View>
              <Field
                label="NOM AFFICHÉ"
                value={profileDraft?.display_name || ""}
                onChangeText={(value: string) => setProfileDraft((p) => ({ ...(p || { user_id: session.user.id }), display_name: value }))}
                placeholder="Comment devons-nous vous appeler ?"
              />
              <Field
                label="PRÉNOM"
                value={profileDraft?.first_name || ""}
                onChangeText={(value: string) =>
                  setProfileDraft((p) => ({
                    ...(p || { user_id: session.user.id }),
                    first_name: value,
                  }))
                }
                error={firstNameError}
              />
              <Field
                label="NOM"
                value={profileDraft?.last_name || ""}
                onChangeText={(value: string) =>
                  setProfileDraft((p) => ({
                    ...(p || { user_id: session.user.id }),
                    last_name: value,
                  }))
                }
                error={lastNameError}
              />
              <Field
                label="TÉLÉPHONE"
                value={profileDraft?.phone || ""}
                onChangeText={(value: string) =>
                  setProfileDraft((p) => ({
                    ...(p || { user_id: session.user.id }),
                    phone: value,
                  }))
                }
                keyboardType="phone-pad"
                error={profilePhoneError}
              />
              <Field
                label="E-MAIL"
                value={session.user.email || ""}
                editable={false}
              />
              <PrimaryButton
                label="SAVE CHANGES"
                loading={saving}
                disabled={!profileDirty || saving}
                onPress={saveProfile}
              />
              {profileFeedback ? <Text accessibilityRole="alert" style={[s.profileFeedback, profileFeedbackError && s.profileFeedbackError]}>{profileFeedback}</Text> : null}
            </View>
          ) : null}
          {page === "addresses" ? (
            <AddressPage
              ref={addressPageRef}
              addresses={addresses}
              token={session.access_token}
              onChanged={() => reload(true)}
            />
          ) : null}
          {page === "language" ? (
            <View>
              <Text style={s.pageHeading}>{t("appLanguage")}</Text>
              {(
                [
                  ["fr", "Français", "France / Maroc"],
                  ["ar", "العربية", "المغرب"],
                  ["en", "English", "International"],
                ] as const
              ).map(([code, label, meta]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: language === code }}
                  key={code}
                  onPress={() => void setLang(code)}
                  style={[s.languageRow, language === code && s.languageActive]}
                >
                  <View>
                    <Text style={s.menuTitle}>{label}</Text>
                    <Text style={s.menuSubtitle}>{meta}</Text>
                  </View>
                  {language === code ? (
                    <Ionicons name="checkmark-circle" size={23} color={GREEN} />
                  ) : (
                    <View style={s.radio} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}
          {page === "notifications" ? (
            <View>
              <Text style={s.pageHeading}>{language === "ar" ? "الإشعارات" : "Notifications"}</Text>
              <Text style={s.copy}>{language === "fr" ? "Choisissez les actualités IPORDISE que vous souhaitez recevoir sur cet appareil." : language === "ar" ? "اختر تحديثات IPORDISE التي تريد استلامها على هذا الجهاز." : "Choose which IPORDISE updates you want to receive on this device."}</Text>
              {push.permission === "denied" ? <View style={s.notificationDisabled}><Ionicons name="notifications-off-outline" size={21} color={RED} /><View style={s.menuCopy}><Text style={s.menuTitle}>{language === "fr" ? "Notifications désactivées" : language === "ar" ? "الإشعارات معطلة" : "Notifications are disabled"}</Text><Text style={s.menuSubtitle}>{language === "fr" ? "Activez-les dans les réglages du téléphone pour recevoir les nouveautés et le suivi des commandes." : language === "ar" ? "فعّلها في إعدادات الهاتف لتلقي أحدث المنتجات وتحديثات الطلبات." : "Enable them in phone settings to receive new arrivals and order updates."}</Text></View><Pressable accessibilityRole="button" onPress={() => void push.openSettings()} style={s.notificationSettingsButton}><Text style={s.notificationSettingsText}>{language === "fr" ? "Réglages" : language === "ar" ? "الإعدادات" : "Open settings"}</Text></Pressable></View> : null}
              {(push.permission === "notDetermined" || push.permission === "unavailable") ? <Pressable accessibilityRole="button" disabled={push.enabling || push.permission === "unavailable"} onPress={() => void push.enable()} style={s.notificationEnableButton}>{push.enabling ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="notifications-outline" size={17} color="#fff"/><Text style={s.notificationEnableText}>{language === "fr" ? "Activer les notifications" : language === "ar" ? "تفعيل الإشعارات" : "Enable notifications"}</Text></>}</Pressable> : null}
              {push.error ? <Text style={s.notificationError}>{push.error}</Text> : null}
              {(
                [
                  ["new_products", language === "fr" ? "Nouveautés" : language === "ar" ? "أحدث المنتجات" : "New arrivals", language === "fr" ? "Soyez informé lorsque de nouveaux parfums sont ajoutés." : language === "ar" ? "تلقي إشعار عند إضافة عطور ومنتجات جديدة." : "Be notified when new fragrances and products are added."],
                  ["order_updates", language === "fr" ? "Suivi des commandes" : language === "ar" ? "تحديثات الطلب" : "Order updates", language === "fr" ? "Confirmation, préparation, expédition et livraison." : language === "ar" ? "تحديثات التأكيد والتحضير والشحن والتسليم." : "Confirmation, preparation, shipping and delivery updates."],
                  ["offers_marketing", language === "fr" ? "Offres et promotions" : language === "ar" ? "العروض والترويج" : "Offers & promotions", language === "fr" ? "Recevez une sélection d’offres IPORDISE." : language === "ar" ? "تلقي عروض مختارة من IPORDISE." : "Receive selected IPORDISE offers."],
                ] as const
              ).map(([key, label, description]) => (
                <View key={key} style={s.toggleRow}>
                  <View style={s.menuCopy}>
                    <Text style={s.menuTitle}>{label}</Text>
                    <Text style={s.menuSubtitle}>{description}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={label}
                    value={preferences[key]}
                    onValueChange={(value) => {
                      void (async () => {
                        const pushPatch = key === "new_products" ? { newProductsEnabled: value } : key === "order_updates" ? { orderUpdatesEnabled: value } : { offersEnabled: value };
                        if (value && push.permission !== "granted" && push.permission !== "provisional" && !(await push.enable(pushPatch))) return;
                        await updatePreferences({ [key]: value });
                      })().catch(() => Alert.alert("Unable to save", "Please try again."));
                    }}
                    trackColor={{ true: "#9bd5b8", false: "#ddd5d1" }}
                    thumbColor={preferences[key] ? GREEN : "#fff"}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {page === "privacy" ? (
            <PrivacyPage token={session.access_token} />
          ) : null}
          {page === "legal" ? <LegalPage /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const AddressPage = forwardRef<AddressPageHandle, {
  addresses: CustomerAddress[];
  token: string;
  onChanged: () => Promise<void>;
}>(function AddressPage({
  addresses,
  token,
  onChanged,
}, ref) {
  const [editing, setEditing] = useState<Partial<CustomerAddress> | null>(null);
  const [saving, setSaving] = useState(false);
  const initialEditingRef = useRef("");
  const beginEditing = useCallback((address: Partial<CustomerAddress>) => {
    const draft = { ...address };
    initialEditingRef.current = JSON.stringify(draft);
    setEditing(draft);
  }, []);
  const requestBack = useCallback(() => {
    if (!editing) return false;
    const discard = () => { initialEditingRef.current = ""; setEditing(null); };
    if (JSON.stringify(editing) !== initialEditingRef.current) {
      Alert.alert("Discard changes?", "Your unsaved address changes will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: discard },
      ]);
    } else discard();
    return true;
  }, [editing]);
  useImperativeHandle(ref, () => ({ requestBack }), [requestBack]);
  useEffect(()=>{if(Platform.OS==='web'||!editing)return;return registerAndroidBackAction(requestBack);},[editing,requestBack]);
  if (editing)
    return (
      <View>
        <Text style={s.pageHeading}>
          {editing.id ? "Modifier l’adresse" : "Nouvelle adresse"}
        </Text>
        {[
          ["label", "LIBELLÉ", "Maison"],
          ["recipient_name", "DESTINATAIRE", "Nom complet"],
          ["phone", "TÉLÉPHONE", "06 12 34 56 78"],
          ["country", "PAYS", "Morocco"],
          ["address_line1", "ADRESSE", "Rue, numéro, quartier"],
          ["address_line2", "COMPLÉMENT", "Appartement, étage (optionnel)"],
          ["building", "IMMEUBLE", "Nom ou numéro (optionnel)"],
          ["apartment", "APPARTEMENT", "Appartement (optionnel)"],
          ["city", "VILLE", "Casablanca"],
          ["region", "RÉGION", "Casablanca-Settat"],
          ["postal_code", "CODE POSTAL", "20000"],
          ["delivery_instructions", "INSTRUCTIONS DE LIVRAISON", "Appelez avant la livraison (optionnel)"],
        ].map(([key, label, placeholder]) => (
          <Field
            key={key}
            label={label}
            value={(editing as any)[key] || ""}
            placeholder={placeholder}
            onChangeText={(value: string) =>
              setEditing((current) => ({ ...current, [key]: value }))
            }
          />
        ))}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!editing.is_default }}
          {...(Platform.OS === 'web' ? ({ 'aria-checked': !!editing.is_default } as any) : {})}
          onPress={() =>
            setEditing((current) => ({
              ...current,
              is_default: !current?.is_default,
            }))
          }
          style={s.checkRow}
        >
          <View style={[s.checkbox, editing.is_default && s.checkboxOn]}>
            {editing.is_default ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : null}
          </View>
          <Text style={s.optionText}>Adresse par défaut</Text>
        </Pressable>
        <PrimaryButton
          label="ENREGISTRER L’ADRESSE"
          loading={saving}
          onPress={async () => {
            if (
              !editing.recipient_name ||
              !editing.phone ||
              !editing.address_line1 ||
              !editing.city
            ) {
              Alert.alert(
                "Missing information",
                "Complete the recipient, phone, address and city.",
              );
              return;
            }
            if (!isValidMoroccanPhone(editing.phone)) {
              Alert.alert(
                "Invalid phone",
                "Enter a valid Moroccan mobile number.",
              );
              return;
            }
            setSaving(true);
            try {
              await saveCustomerAddress(token, editing as any);
              initialEditingRef.current = "";
              setEditing(null);
              await onChanged();
            } catch (e) {
              Alert.alert(
                "Unable to save",
                e instanceof Error ? e.message : "Try again.",
              );
            } finally {
              setSaving(false);
            }
          }}
        />
        <Pressable onPress={requestBack} style={s.textButton}>
          <Text style={s.textButtonText}>Annuler</Text>
        </Pressable>
      </View>
    );
  return (
    <View>
      <Text style={s.pageHeading}>Livraison au Maroc</Text>
      <Text style={s.copy}>
        Ajoutez vos adresses pour accélérer la commande.
      </Text>
      {!addresses.length ? <View style={s.emptyState}><Ionicons name="location-outline" size={34} color="#9b8e87" /><Text style={s.cardTitle}>No saved addresses yet.</Text><Text style={s.copy}>Add a delivery address for faster checkout.</Text></View> : null}
      {addresses.map((address) => (
        <View key={address.id} style={s.addressCard}>
          <View style={s.addressTop}>
            <View style={s.menuIcon}>
              <Ionicons
                name={
                  address.label.toLowerCase().includes("travail")
                    ? "business-outline"
                    : "home-outline"
                }
                size={20}
                color={INK}
              />
            </View>
            <View style={s.menuCopy}>
              <Text style={s.menuTitle}>
                {address.label} {address.is_default ? "· Par défaut" : ""}
              </Text>
              <Text style={s.menuSubtitle}>
                {address.recipient_name} · {address.phone}
                {"\n"}
                {address.address_line1}, {address.city}
              </Text>
            </View>
          </View>
          <View style={s.addressActions}>
            {!address.is_default ? <Pressable onPress={async () => { await saveCustomerAddress(token, { ...address, is_default: true }); await onChanged(); }}><Text style={s.link}>Set as default</Text></Pressable> : null}
            <Pressable onPress={() => beginEditing(address)}>
              <Text style={s.link}>Modifier</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Delete address?", "This cannot be undone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      await deleteCustomerAddress(token, address.id);
                      await onChanged();
                    },
                  },
                ])
              }
            >
              <Text style={s.dangerText}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <PrimaryButton
        label="AJOUTER UNE ADRESSE"
        icon="add"
        onPress={() =>
          beginEditing({ label: "Maison", country: "Morocco", is_default: addresses.length === 0 })
        }
      />
    </View>
  );
});

function LegalPage() {
  const { t } = useLanguage();
  const openDocument = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Document unavailable", "We couldn't open this document. Contact IPORDISE Care for assistance."); }
  };
  return (
    <View>
      <Text style={s.pageHeading}>{t("legal")}</Text>
      <Text style={s.copy}>{t("legalIntro")}</Text>
      <View style={s.panel}>
        <Pressable accessibilityRole="link" accessibilityLabel={t("privacyPolicy")} onPress={() => void openDocument(appConfig.privacyPolicyUrl)} style={({ pressed }) => [s.legalRow, pressed && s.quickActionPressed]}><View style={s.menuIcon}><Ionicons name="person-circle-outline" size={21} color={INK} /></View><View style={s.menuCopy}><Text style={s.menuTitle}>{t("privacyPolicy")}</Text><Text style={s.menuSubtitle}>{t("privacyPolicyCopy")}</Text></View><Ionicons name="open-outline" size={17} color="#8b817b" /></Pressable>
        <View style={s.legalDivider} />
        <Pressable accessibilityRole="link" accessibilityLabel={t("shoppingTerms")} onPress={() => void openDocument(appConfig.termsUrl)} style={({ pressed }) => [s.legalRow, pressed && s.quickActionPressed]}><View style={s.menuIcon}><Ionicons name="receipt-outline" size={21} color={INK} /></View><View style={s.menuCopy}><Text style={s.menuTitle}>{t("shoppingTerms")}</Text><Text style={s.menuSubtitle}>{t("shoppingTermsCopy")}</Text></View><Ionicons name="open-outline" size={17} color="#8b817b" /></Pressable>
      </View>
      <View style={s.privacyNote}><Ionicons name="information-circle-outline" size={18} color={GREEN} /><Text style={s.privacyNoteText}>{t("legalSupportNote")}</Text></View>
    </View>
  );
}

function PasswordResetPage({ token, onComplete }: { token: string; onComplete: () => void }) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const invalid = touched && password && !isStrongPassword(password) ? t("weakPasswordHelp") : "";
  const mismatch = touched && confirm && password !== confirm ? t("passwordMismatch") : "";
  const submit = async () => {
    setTouched(true);
    if (!isStrongPassword(password) || password !== confirm || saving) return;
    setSaving(true); setError("");
    try { await updateCustomerPassword(token, password); setPassword(""); setConfirm(""); setComplete(true); }
    catch (cause) { setError(authErrorMessage(cause, t)); }
    finally { setSaving(false); }
  };
  if (complete) return <View style={s.resetSuccess}><View style={s.stateIcon}><Ionicons name="checkmark-circle-outline" size={30} color={GREEN} /></View><Text style={s.cardTitle}>{t("passwordResetSuccessTitle")}</Text><Text style={s.copy}>{t("passwordResetSuccessCopy")}</Text><PrimaryButton label={t("continueToAccount")} onPress={onComplete} /></View>;
  return <View><Text style={s.pageHeading}>{t("newPasswordTitle")}</Text><Text style={s.copy}>{t("newPasswordCopy")}</Text><View style={s.panel}><Field label={t("newPassword")} value={password} onChangeText={setPassword} secure placeholder={t("passwordRuleShort")} autoComplete="new-password" textContentType="newPassword" onBlur={() => setTouched(true)} error={invalid} /><Field label={t("confirmPassword")} value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" textContentType="newPassword" onBlur={() => setTouched(true)} error={mismatch} />{error ? <View accessibilityRole="alert" style={s.errorBox}><Ionicons name="alert-circle-outline" size={17} color={RED} /><Text style={s.errorBoxText}>{error}</Text></View> : null}<PrimaryButton label={t("updatePassword")} loading={saving} disabled={!isStrongPassword(password) || password !== confirm} onPress={submit} /></View></View>;
}

function PrivacyPage({ token }: { token: string }) {
  const { t } = useLanguage();
  const { session, reauthenticate, signOut } = useCustomerAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const closeDelete = () => { if (deleteLoading) return; setDeleteDialog(false); setDeleteEmail(""); setDeletePassword(""); setDeleteError(""); };
  const deletionConfirmed = Boolean(session?.user.email) && normalizeEmail(deleteEmail) === normalizeEmail(session?.user.email || "") && Boolean(deletePassword);
  const requestDeletion = async () => {
    if (!deletionConfirmed || deleteLoading) return;
    setDeleteLoading(true); setDeleteError("");
    try {
      const freshToken = await reauthenticate(deletePassword);
      await deleteCustomerAccount(freshToken);
      await signOut();
      setDeleteDialog(false); setDeleteEmail(""); setDeleteError("");
      Alert.alert(t("deletionRequested"), t("deletionRequestCopy"));
    } catch (cause) { setDeleteError(authErrorMessage(cause, t)); }
    finally { setDeleteLoading(false); setDeletePassword(""); }
  };
  return (
    <View>
      <Text style={s.pageHeading}>{t("securityDataTitle")}</Text>
      <Text style={s.copy}>{t("securityDataCopy")}</Text>
      <View style={s.panel}>
        <Text style={s.cardTitle}>{t("changePassword")}</Text>
        <Field
          label={t("newPassword")}
          value={password}
          onChangeText={setPassword}
          secure
          placeholder={t("passwordRuleShort")}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Field
          label={t("confirmPassword")}
          value={confirm}
          onChangeText={setConfirm}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
        />
        {passwordError ? <Text accessibilityRole="alert" style={s.errorText}>{passwordError}</Text> : null}
        <PrimaryButton
          label={t("updatePassword")}
          loading={saving}
          disabled={!isStrongPassword(password) || password !== confirm}
          onPress={async () => {
            if (saving) return;
            setSaving(true);
            setPasswordError("");
            try {
              await updateCustomerPassword(token, password);
              setPassword("");
              setConfirm("");
              Alert.alert(t("passwordUpdated"), t("passwordUpdatedCopy"));
            } catch (cause) {
              setPasswordError(authErrorMessage(cause, t));
            } finally {
              setSaving(false);
            }
          }}
        />
      </View>
      <View style={s.menuCard}>
        <MenuRow
          icon="download-outline"
          title={t("downloadData")}
          subtitle={t("downloadDataCopy")}
          onPress={() =>
            Alert.alert(
              t("requestDataTitle"),
              t("requestDataCopy"),
              [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("request"),
                  onPress: async () => {
                    try { await requestDataExport(token); Alert.alert(t("requestReceived"), t("dataExportRecorded")); }
                    catch { Alert.alert(t("requestFailed"), t("tryAgainLater")); }
                  },
                },
              ],
            )
          }
        />
        <MenuRow
          danger
          icon="trash-outline"
          title={t("requestDeletion")}
          subtitle={t("requestDeletionCopy")}
          onPress={() => setDeleteDialog(true)}
        />
      </View>
      <ConfirmationDialog visible={deleteDialog} danger title={t("deleteDialogTitle")} body={t("deleteDialogBody")} confirmLabel={t("confirmDeletion")} cancelLabel={t("cancel")} loading={deleteLoading} confirmDisabled={!deletionConfirmed} onCancel={closeDelete} onConfirm={() => void requestDeletion()}>
        <View style={s.dialogFields}><Field label={t("confirmEmail")} value={deleteEmail} onChangeText={setDeleteEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" /><Field label={t("currentPassword")} value={deletePassword} onChangeText={setDeletePassword} secure autoComplete="current-password" textContentType="password" />{deleteError ? <Text accessibilityRole="alert" style={s.errorText}>{deleteError}</Text> : null}</View>
      </ConfirmationDialog>
    </View>
  );
}

export function CustomerAccountScreen(props: {
  onShop: (filter: string) => void;
  onWishlist: () => void;
  onBag: () => void;
  onHelp: (destination?: "track") => void;
  initialOrderId?: string | null;
  onInitialOrderHandled?: () => void;
  bottomInset: number;
}) {
  const { session, ready, recoveryMode, clearRecoveryMode } = useCustomerAuth();
  const { t } = useLanguage();
  useEffect(()=>{if(Platform.OS==='web'||!recoveryMode)return;return registerAndroidBackAction(()=>{clearRecoveryMode();return true;});},[clearRecoveryMode,recoveryMode]);
  if (!ready)
    return (
      <View style={s.fullLoading}>
        <View accessibilityLabel={t("loading")} style={s.loadingShell}>
          <View style={[s.skeleton, s.loadingBrand]} />
          <View style={[s.skeleton, s.loadingHero]} />
          <View style={[s.skeleton, s.loadingCard]} />
        </View>
      </View>
    );
  if (session && recoveryMode)
    return (
      <View style={s.flex}>
        <BrandHeader title={t("newPasswordTitle")} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: props.bottomInset + 32 },
          ]}
        >
          <View style={s.content}>
            <PasswordResetPage token={session.access_token} onComplete={clearRecoveryMode} />
          </View>
        </ScrollView>
      </View>
    );
  return session ? (
    <LoggedInAccount {...props} />
  ) : (
    <LoggedOutAccount onShop={props.onShop} onWishlist={props.onWishlist} onBag={props.onBag} onHelp={() => props.onHelp()} bottomInset={props.bottomInset} />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
   scroll: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#f8f7f5", ...Platform.select({ web: { paddingHorizontal: 0, boxSizing: "border-box" } as any }) },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 14, ...Platform.select({ web: { boxSizing: "border-box" } as any }) },
  contentWide: { maxWidth: 960 },
  rtl: {},
  rtlDirection: { direction: "rtl" },
  guestLead: { gap: 14 },
  guestLeadWide: { flexDirection: "row", alignItems: "stretch", gap: 16 },
  guestWelcome: { borderRadius: 20, borderWidth: 1, borderColor: "#e7e2de", backgroundColor: "#fff", padding: 20, flexDirection: "row", alignItems: "center", gap: 15 },
  guestWelcomeWide: { flex: 1, minHeight: 260, flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: 28 },
  guestAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#f3efec", borderWidth: 1, borderColor: "#e4ddd8", alignItems: "center", justifyContent: "center" },
  guestWelcomeCopy: { flex: 1, minWidth: 0 },
  guestEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.1, color: RED, textTransform: "uppercase" },
  guestTitle: { marginTop: 4, fontFamily: "serif", fontSize: 25, lineHeight: 30, fontWeight: "900", color: INK, letterSpacing: -.35 },
  guestDescription: { marginTop: 6, maxWidth: 440, fontSize: 12, lineHeight: 18, color: "#726965" },
  preferenceBar: { flexDirection: "row", alignItems: "stretch", justifyContent: "flex-end", gap: 8 },
  preferenceBarCompact: { width: "100%", minHeight: 46, alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 0, backgroundColor: "transparent", padding: 0, overflow: "hidden" },
  preferenceControl: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: "#e7ded9", backgroundColor: "#fff", paddingHorizontal: 9, paddingVertical: 5, justifyContent: "center", shadowColor: "#2a1714", shadowOpacity: .025, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  preferenceControlWide: { flex: 1, maxWidth: 250 },
  preferenceLanguageCompact: { minWidth: 0, minHeight: 46, flex: 1, flexShrink: 1, borderWidth: 1, borderColor: "#e5dad5", borderRadius: 15, paddingHorizontal: 4, paddingVertical: 4, backgroundColor: "#fff", shadowColor: "#2a1714", shadowOpacity: .055, shadowRadius: 9, shadowOffset: {width:0,height:4}, elevation: 1 },
  preferenceLanguageHeader: { width: 88, minHeight: 44, flex: 0, borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  preferenceLabel: { fontSize: 7, lineHeight: 9, fontWeight: "900", letterSpacing: .35, color: "#8b7d76", marginBottom: 3 },
  currencyControl: { width: 96 },
  currencyControlCompact: { width: 82, flexShrink: 0, minHeight: 46, borderWidth: 1, borderColor: "#e5dad5", borderRadius: 15, paddingLeft: 12, paddingRight: 9, paddingVertical: 4, backgroundColor: "#fff", shadowColor: "#2a1714", shadowOpacity: .055, shadowRadius: 9, shadowOffset: {width:0,height:4}, elevation: 1 },
  currencyValue: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  currencyText: { fontSize: 12, fontWeight: "900", color: INK, letterSpacing: .4 },
  languageSwitcher: {
    minHeight: 36,
    borderRadius: 11,
    backgroundColor: "#f5f1ef",
    padding: 2,
    flexDirection: "row",
    gap: 2,
  },
  languageSwitcherHeader: { minHeight: 42, borderRadius: 0, backgroundColor: "transparent", padding: 0, gap: 0 },
  languageChoice: {
    flex: 1,
    minWidth: 44,
    minHeight: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  languageChoiceActive: { backgroundColor: "#251317", shadowColor: "#251317", shadowOpacity: .18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  languageChoiceHeader: { minWidth: 40, minHeight: 42, borderRadius: 0, backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  languageChoiceHeaderActive: { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
  languageChoiceText: { fontSize: 9, fontWeight: "900", color: "#756a64", letterSpacing: .35 },
  languageChoiceTextActive: { color: "#fff" },
  languageChoiceTextHeaderActive: { color: INK },
  languageHeaderIndicator: { position: "absolute", left: 12, right: 12, bottom: 6, height: 1.5, borderRadius: 1, backgroundColor: RED },
   header: {
     height: 58,
     paddingHorizontal: 18,
     borderBottomWidth: 1,
     borderBottomColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     flexDirection: "row",
     alignItems: "center",
     justifyContent: "space-between",
     shadowColor: INK,
     shadowOpacity: 0.04,
     shadowRadius: 8,
     shadowOffset: { width: 0, height: 2 },
     elevation: 1,
   },
  headerPhone: { height: 66, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#eee8e4", backgroundColor: "#fffdf9", shadowOpacity: 0, elevation: 0 },
  headerSide: { width: 40 },
  headerBrand: { position: "absolute", left: 96, right: 96, alignItems: "center" },
  brand: { fontFamily: "serif", fontWeight: "900", fontSize: 22, letterSpacing: .65, color: INK },
  brandAccent: { width: 27, height: 2, borderRadius: 1, backgroundColor: RED, marginTop: 4 },
  headerLanguage: { width: 88, minHeight: 44, justifyContent: "center" },
  headerMarket: { minWidth: 67, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  headerMarketText: { fontSize: 8.5, lineHeight: 12, fontWeight: "900", letterSpacing: .85, color: INK },
  headerMarketDivider: { width: 1, height: 14, backgroundColor: "#ded5d0" },
  headerTitle: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    color: RED,
    marginTop: 1,
  },
   iconButton: {
     width: 40,
     height: 40,
     borderRadius: 14,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     alignItems: "center",
     justifyContent: "center",
     shadowColor: INK,
     shadowOpacity: 0.05,
     shadowRadius: 4,
     shadowOffset: { width: 0, height: 1 },
     elevation: 1,
   },
  secure: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: "#edf8f1",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  securePhone: { width: 40, minHeight: 40, paddingHorizontal: 0, borderRadius: 15, justifyContent: "center", borderWidth: 1, borderColor: "#dce9e1", backgroundColor: "#fff", shadowColor: "#193425", shadowOpacity: .06, shadowRadius: 7, shadowOffset: {width:0,height:3}, elevation: 1 },
  mobileMemberHero: { minHeight: 184, marginTop: 10, borderRadius: 25, paddingHorizontal: 20, paddingTop: 17, paddingBottom: 34, overflow: "hidden", borderWidth: 1, borderColor: "#32151c", shadowColor: "#1b090d", shadowOpacity: .2, shadowRadius: 16, shadowOffset: {width:0,height:8}, elevation: 4 },
  mobileHeroPhoto: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  mobileHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 8 },
  mobileHeroIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
  mobileHeroSecure: { minHeight: 26, borderRadius: 13, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.13)" },
  mobileHeroDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#69d798" },
  mobileHeroSecureText: { fontSize: 7, lineHeight: 9, color: "#c7f1d8", fontWeight: "900", letterSpacing: 1 },
  mobileHeroEyebrow: { marginTop: 17, fontSize: 7.5, lineHeight: 10, color: "#ff7897", fontWeight: "900", letterSpacing: 1.45 },
  mobileHeroTitle: { marginTop: 4, maxWidth: "55%", fontFamily: "serif", fontSize: 22, lineHeight: 25, color: "#fff", fontWeight: "800", letterSpacing: -.35 },
  mobileHeroCopy: { marginTop: 5, maxWidth: "53%", fontSize: 9.5, lineHeight: 13.5, color: "rgba(255,255,255,.76)" },
  secureText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    color: GREEN,
  },
  welcomeCard: {
    minHeight: 220,
    borderRadius: 22,
    backgroundColor: "#140b0e",
    padding: 18,
    justifyContent: "flex-start",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(68,28,38,.42)",
    shadowColor: "#1c0c10",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  welcomeCardCompact: { minHeight: 210, padding: 18 },
  welcomeCardWide: { flex: 1.08, minHeight: 316 },
  welcomeImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  welcomeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  welcomeBrand: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.25,
    color: "#fff",
  },
  privateBadge: {
    height: 27,
    borderRadius: 13.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    backgroundColor: "rgba(18,9,12,.52)",
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  privateText: {
    fontSize: 6.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#b9f5d5",
  },
  eyebrowLight: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#ff7997",
  },
  welcomeEyebrowRow: { marginTop: 31, flexDirection: "row", alignItems: "center", gap: 7 },
  welcomeEyebrowCompact: { marginTop: 8 },
  welcomeAccent: { width: 18, height: 2, borderRadius: 1, backgroundColor: "#ef3159" },
  welcomeTitle: {
    fontFamily: "serif",
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "800",
    color: "#fff",
    maxWidth: "67%",
    letterSpacing: -0.35,
    marginTop: 8,
  },
  welcomeTitleCompact: { fontSize: 27, lineHeight: 29, maxWidth: "64%", marginTop: 7, letterSpacing: -.45 },
  welcomeCopy: {
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,.82)",
    maxWidth: "63%",
    marginTop: 8,
  },
  welcomeCopyCompact: { fontSize: 10.5, lineHeight: 15, maxWidth: "61%", marginTop: 7, color: "rgba(255,255,255,.74)" },
  welcomeStats: {
    height: 68,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.13)",
    backgroundColor: "rgba(255,255,255,.06)",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
  },
  welcomeStat: { flex: 1, alignItems: "center", gap: 2 },
  divider: { height: 32, width: 1, backgroundColor: "rgba(255,255,255,.16)" },
  statValue: {
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  statLabel: {
    fontSize: 5.5,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#bcaeb1",
  },
  authCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e8dfda",
    backgroundColor: "#fff",
    padding: 20,
    gap: 12,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  authCardCompact: { marginHorizontal: 0, marginTop: 0, borderWidth: 1, borderColor: "#e7e2de", borderRadius: 20, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16, backgroundColor: "#fff", shadowOpacity: 0, elevation: 0, gap: 13 },
  authCardFormCompact: { marginTop: 0, paddingTop: 18 },
  authCardWide: { flex: .92, minWidth: 0 },
  authStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountIntro: { gap: 7, paddingBottom: 5 },
  accountIntroCompact: { paddingTop: 1, paddingBottom: 4 },
  introRuleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  introRule: { width: 20, height: 2, borderRadius: 1, backgroundColor: RED },
  introTitle: { marginTop: 2, letterSpacing: -.45 },
  introTitleCompact: { fontSize: 24, lineHeight: 29 },
  introCopy: { maxWidth: 510 },
  eyebrow: { fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 1.35, color: RED },
  protected: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 14,
    backgroundColor: "#edf8f1",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  protectedText: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1,
    color: GREEN,
  },
   cardTitle: {
     fontFamily: "serif",
     fontSize: 28,
     lineHeight: 32,
     fontWeight: "900",
     color: INK,
     letterSpacing: -0.35,
   },
  copy: { fontSize: 11.5, lineHeight: 17, color: "#776c66", maxWidth: 430 },
   primary: {
     minHeight: 56,
     borderRadius: 18,
     backgroundColor: RED,
     paddingLeft: 22,
     paddingRight: 8,
     flexDirection: "row",
     alignItems: "center",
     justifyContent: "space-between",
     shadowColor: RED,
     shadowOpacity: 0.18,
     shadowRadius: 12,
     shadowOffset: { width: 0, height: 6 },
     elevation: 4,
   },
  primaryCompact: { minHeight: 55, borderRadius: 17, paddingLeft: 18, paddingRight: 7, shadowOpacity: .14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
   primaryHover: { backgroundColor: "#d62838" },
  primaryText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.35,
    color: "#fff",
  },
  primaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryIconCompact: { width: 40, height: 40, borderRadius: 20 },
   secondary: {
     minHeight: 54,
     borderRadius: 18,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     alignItems: "center",
     justifyContent: "center",
     shadowColor: INK,
     shadowOpacity: 0.05,
     shadowRadius: 8,
     shadowOffset: { width: 0, height: 2 },
     elevation: 1,
   },
  secondaryCompact: { minHeight: 51, borderRadius: 16, backgroundColor: "#faf8f7", borderColor: "#ddd2cd" },
  secondaryText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    color: INK,
  },
  textButton: { minHeight: 46, alignSelf: "center", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  textButtonPressed: { opacity: .58, transform: [{ translateX: 2 }] },
  textButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6d615b",
  },
  backLink: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
  },
  backLinkText: { fontSize: 10, fontWeight: "800", color: INK },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#584d48",
  },
   field: {
     height: 56,
     borderRadius: 16,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     flexDirection: "row",
     alignItems: "center",
     shadowColor: INK,
     shadowOpacity: 0.04,
     shadowRadius: 6,
     shadowOffset: { width: 0, height: 2 },
     elevation: 1,
   },
  fieldError: { borderColor: RED, backgroundColor: "#fff8fa" },
  fieldFocused: { borderColor: INK, borderWidth: 2 },
  focusRing: { borderColor: RED, borderWidth: 2 },
  surfaceHover: { backgroundColor: "#faf6f4" },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 13,
    color: INK,
    outlineStyle: "none",
  } as any,
  fieldAction: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { fontSize: 9, lineHeight: 13, color: RED },
  twoFields: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minHeight: 44,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d8ccc6",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: GREEN, borderColor: GREEN },
  optionText: { flex: 1, fontSize: 11, lineHeight: 16, color: "#665b55" },
  link: {
    fontSize: 10.5,
    fontWeight: "900",
    color: RED,
    textDecorationLine: "underline",
  },
  inlineLinkButton: { minHeight: 44, justifyContent: "center" },
  switchPrompt: { fontSize: 10, textAlign: "center", color: "#746962" },
  centerState: { alignItems: "center", gap: 14 },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#edf8f1",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0d4dc",
    backgroundColor: "#fff4f6",
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  noticeIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#ffe8ee", alignItems: "center", justifyContent: "center" },
  errorBoxText: { flex: 1, fontSize: 10, lineHeight: 14, color: "#8e1730" },
  inlineRetry: { minWidth: 62, minHeight: 44, borderRadius: 14, backgroundColor: INK, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  inlineRetryText: { fontSize: 8.5, fontWeight: "900", letterSpacing: .4, color: "#fff" },
  successBox: {
    borderRadius: 14,
    backgroundColor: "#edf8f1",
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  successText: { flex: 1, fontSize: 10, lineHeight: 14, color: GREEN },
  trustRow: { flexDirection: "row", gap: 8 },
  trustItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6ddd8",
    padding: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  trustText: {
    fontSize: 7,
    lineHeight: 10,
    fontWeight: "800",
    textAlign: "center",
    color: "#5d524d",
  },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
   benefitsSection: { borderRadius: 20, borderWidth: 1, borderColor: "#e7e2de", backgroundColor: "#fff", padding: 18, gap: 14 },
  benefitsSectionCompact: { marginTop: 14, padding: 17, borderRadius: 22, shadowColor: "#2a1714", shadowOpacity: .05, shadowRadius: 10, shadowOffset: {width:0,height:4}, elevation: 1 },
  benefitsHeading: { gap: 4 },
   benefitsTitle: { width: "100%", flexShrink: 1, fontFamily: "serif", fontSize: 24, lineHeight: 29, fontWeight: "900", color: INK, letterSpacing: -0.3 },
  benefitsTitleCompact: { fontSize: 21, lineHeight: 26 },
  guestQuickActions: { flexDirection: "row", gap: 8 },
  guestQuickAction: { flex: 1, minWidth: 0, minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: "#e8e2de", backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 11, alignItems: "center", justifyContent: "center", gap: 6 },
  guestQuickActionHover: { borderColor: "#d2c7c1", backgroundColor: "#fcfaf9" },
  guestQuickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#f3efec", alignItems: "center", justifyContent: "center" },
  guestQuickLabel: { minHeight: 26, fontSize: 9, lineHeight: 13, fontWeight: "800", color: INK, textAlign: "center" },
  privacyNote: { minHeight: 52, borderRadius: 16, backgroundColor: "#eef7f1", borderWidth: 1, borderColor: "#d9e9df", paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  privacyNoteText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: "#466252" },
   accountIdentity: {
     borderRadius: 20,
     backgroundColor: "#fff",
     padding: 18,
     flexDirection: "row",
     alignItems: "center",
     gap: 14,
     borderWidth: 1,
     borderColor: "#e7e2de",
   },
  editProfileButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#ded7d2", backgroundColor: "#faf8f7", alignItems: "center", justifyContent: "center" },
   avatar: {
     width: 60,
     height: 60,
     borderRadius: 30,
     backgroundColor: "#f4efec",
     alignItems: "center",
     justifyContent: "center",
     borderWidth: 1,
     borderColor: "#e2d9d4",
   },
  avatarText: {
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "900",
    color: RED,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 30 },
  memberCopy: { flex: 1 },
  accountIdentityLabel: { fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 1.2, color: RED, textTransform: "uppercase" },
  accountIdentityName: { marginTop: 3, fontFamily: "serif", fontSize: 22, lineHeight: 27, fontWeight: "900", color: INK, letterSpacing: -.25 },
   memberTitle: {
     fontFamily: "serif",
     fontSize: 22,
     lineHeight: 26,
     fontWeight: "900",
     color: "#fff",
     marginTop: 4,
     letterSpacing: -0.3,
   },
  memberMetaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, minWidth: 0 },
  verifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#62d28b" },
  verifiedText: { fontSize: 7.5, lineHeight: 10, fontWeight: "800", color: GREEN },
  memberMetaDivider: { width: 1, height: 10, backgroundColor: "#ddd5d0", marginHorizontal: 2 },
  memberEmail: { flex: 1, fontSize: 9, lineHeight: 12, color: "#766c66" },
  quickActions: { flexDirection: "row", gap: 9 },
  quickActionHover: { borderColor: "#cfc5bf", backgroundColor: "#fff" },
  quickActionPressed: { opacity: .78, transform: [{ scale: .98 }] },
  quickActionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3efec", alignItems: "center", justifyContent: "center" },
   statsCard: {
     minHeight: 90,
     borderRadius: 22,
     backgroundColor: "#fff",
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     flexDirection: "row",
     alignItems: "center",
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
   profileProgressCard:{minHeight:92,borderRadius:20,borderWidth:1,borderColor:LIGHT_GRAY,backgroundColor:'#fff',padding:15,flexDirection:'row',alignItems:'center',gap:12,shadowColor:INK,shadowOpacity:0.06,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},
   profileProgressIcon:{width:48,height:48,borderRadius:15,backgroundColor:'rgba(212, 175, 55, 0.15)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(212, 175, 55, 0.25)'},
  profileProgressCopy:{flex:1,minWidth:0},
  profileProgressHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
   profileProgressTitle:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.1,color:WARM_BROWN},
   profileProgressValue:{fontSize:10,lineHeight:13,fontWeight:'900',color:RED,letterSpacing:-0.2},
  profileProgressTrack:{height:5,borderRadius:3,backgroundColor:'#eee7e3',overflow:'hidden',marginTop:7},
  profileProgressFill:{height:'100%',borderRadius:3,backgroundColor:RED},
  profileProgressText:{fontSize:8.5,lineHeight:12,color:'#7b706a',marginTop:6},
  profileEditorHero:{minHeight:142,borderRadius:22,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',padding:16,marginTop:14,marginBottom:5,flexDirection:'row',alignItems:'center',gap:16,shadowColor:'#2a1714',shadowOpacity:.055,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:2},
  profileEditorHeroCompact:{alignItems:'flex-start',padding:14,gap:12},
  profilePhotoButton:{width:86,height:86,alignItems:'center',justifyContent:'center'},
  profileEditorAvatar:{width:82,height:82,borderRadius:27,backgroundColor:'#ffe9ef',borderWidth:3,borderColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden',shadowColor:INK,shadowOpacity:.12,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:2},
  profilePhotoBadge:{position:'absolute',right:-1,bottom:-1,width:31,height:31,borderRadius:12,backgroundColor:RED,borderWidth:3,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
  profileEditorCopy:{flex:1,minWidth:0},
  profileEditorEyebrow:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:1.15,color:RED},
  profileEditorTitle:{fontFamily:'serif',fontSize:18,lineHeight:22,fontWeight:'800',color:INK,marginTop:2},
  profileEditorText:{fontSize:8.5,lineHeight:13,color:'#776b65',marginTop:3},
  profilePhotoActions:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7,marginTop:8},
  choosePhotoAction:{minHeight:36,alignSelf:'flex-start',paddingHorizontal:11,borderRadius:18,backgroundColor:'#fff0f4',flexDirection:'row',alignItems:'center',gap:6},
  choosePhotoText:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:.8,color:RED},
  removePhotoAction:{minHeight:36,paddingHorizontal:10,borderRadius:18,borderWidth:1,borderColor:'#e5ded9',backgroundColor:'#faf8f7',flexDirection:'row',alignItems:'center',gap:5},
  removePhotoText:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:.8,color:'#756963'},
  controlDisabled:{opacity:.5},
  profileFeedback:{fontSize:9,lineHeight:13,fontWeight:'700',color:GREEN,textAlign:'center',marginTop:8},
  profileFeedbackError:{color:RED},
  accountStat: { flex: 1, minWidth: 0, minHeight: 112, borderRadius: 18, borderWidth: 1, borderColor: "#e7e2de", backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 4 },
   accountStatValue: {
     fontFamily: "serif",
     fontSize: 20,
     fontWeight: "900",
     color: INK,
     letterSpacing: -0.2,
   },
  accountStatLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#776c66",
  },
  statDivider: { display: "none" },
  loadingState: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  skeletonWrap: { borderRadius: 20, borderWidth: 1, borderColor: "#e5dbd6", backgroundColor: "#fff", padding: 16, gap: 11 },
  skeleton: { borderRadius: 10, backgroundColor: "#eee9e6" },
  skeletonTitle: { width: "38%", height: 14 },
  skeletonOrder: { width: "100%", height: 92 },
  skeletonRow: { width: "100%", height: 48 },
  accountError: { minHeight: 76, borderRadius: 18, backgroundColor: "#fffaf2", borderWidth: 1, borderColor: "#eadcc7", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  accountErrorIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#f6ead8", alignItems: "center", justifyContent: "center" },
  accountErrorCopy: { flex: 1, minWidth: 0 },
  accountErrorTitle: { fontSize: 11, lineHeight: 15, fontWeight: "900", color: "#6e481e", marginBottom: 2 },
  accountErrorText: { fontSize: 8.5, lineHeight: 12, color: "#8a6b47" },
  retryButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#f2e5d2", alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: .4 },
   recentOrder: { borderRadius: 22, borderWidth: 1, borderColor: LIGHT_GRAY, backgroundColor: "#fff", padding: 18, gap: 14, shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  recentOrderHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  recentOrderNumber: { fontFamily: "serif", fontSize: 19, lineHeight: 23, fontWeight: "800", color: INK, marginTop: 3 },
  recentOrderBody: { flexDirection: "row", alignItems: "center", gap: 12 },
   orderThumb: { width: 68, height: 68, borderRadius: 16, backgroundColor: DARK_CREAM, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: LIGHT_GRAY },
  orderThumbImage: { width: "88%", height: "88%" },
  recentOrderCopy: { flex: 1, minWidth: 0 },
  recentOrderName: { fontSize: 13, lineHeight: 18, fontWeight: "800", color: INK },
  recentOrderMeta: { fontSize: 10.5, lineHeight: 15, color: "#7d716b", marginTop: 4 },
  orderActions: { flexDirection: "row", gap: 8 },
  orderPrimaryAction: { flex: 1.2, minHeight: 46, borderRadius: 16, backgroundColor: RED, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  orderPrimaryText: { fontSize: 8.5, fontWeight: "900", color: "#fff", letterSpacing: .35, textAlign: "center" },
  orderSecondaryAction: { flex: 1, minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: "#d9cec8", paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  orderSecondaryText: { fontSize: 8.5, fontWeight: "900", color: INK, textAlign: "center" },
   noRecentOrder: { minHeight: 90, borderRadius: 20, borderWidth: 1, borderColor: LIGHT_GRAY, backgroundColor: "#fff", padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
   noRecentIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: "rgba(212, 175, 55, 0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(212, 175, 55, 0.25)" },
  noRecentCopy: { flex: 1, minWidth: 0 },
  noRecentTitle: { fontSize: 12, lineHeight: 16, fontWeight: "900", color: INK },
  noRecentAction: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#f2ece9", alignItems: "center", justifyContent: "center" },
  sectionLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: .75,
    color: "#4d4541",
    marginTop: 12,
    marginLeft: 2,
    textTransform: "uppercase",
  },
   menuCard: {
     borderRadius: 18,
     backgroundColor: "#fff",
     borderWidth: 1,
     borderColor: "#e7e2de",
     overflow: "hidden",
   },
  hiddenShoppingMenu: { display: "none" },
  menuRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e6ddd8",
  },
   menuIcon: {
     width: 40,
     height: 40,
     borderRadius: 20,
     backgroundColor: "#f4f1ef",
     alignItems: "center",
     justifyContent: "center",
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
   },
   dangerIcon: { backgroundColor: "rgba(230, 57, 70, 0.1)", borderColor: "rgba(230, 57, 70, 0.2)" },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: INK },
  menuSubtitle: { fontSize: 10.5, lineHeight: 15, color: "#7d736d", marginTop: 2 },
  infoRow: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  infoRowValue: { marginLeft: "auto", fontSize: 11, lineHeight: 15, fontWeight: "700", color: "#847a74" },
  signOut: {
    minHeight: 52,
    width: "100%",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#efcfd6",
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: { fontSize: 11, fontWeight: "900", color: RED },
  pageHeading: {
    fontFamily: "serif",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: INK,
  },
   orderCard: {
     minHeight: 92,
     borderRadius: 20,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     padding: 16,
     flexDirection: "row",
     alignItems: "center",
     justifyContent: "space-between",
     marginTop: 12,
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
  orderNumber: {
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "800",
    color: INK,
  },
  statusPill: {
    borderRadius: 13,
    backgroundColor: "#fff1dc",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  statusText: { fontSize: 6.5, fontWeight: "900", color: "#a45e00" },
  orderDetailHero:{minHeight:108,borderRadius:22,backgroundColor:INK,padding:17,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  orderDetailEyebrow:{fontSize:6,fontWeight:'900',letterSpacing:1.1,color:'#e9a6b5'},
  orderDetailNumber:{fontFamily:'serif',fontSize:24,lineHeight:29,fontWeight:'800',color:'#fff',marginTop:3},
  orderDetailPanel:{borderRadius:20,borderWidth:1,borderColor:LIGHT_GRAY,backgroundColor:'#fff',padding:16,marginTop:12},
  timelineRow:{minHeight:54,flexDirection:'row',gap:12},
  timelineRail:{width:22,alignItems:'center'},
  timelineDot:{width:21,height:21,borderRadius:11,borderWidth:1,borderColor:'#d8d0cb',backgroundColor:'#f6f2ef',alignItems:'center',justifyContent:'center'},
  timelineDotComplete:{borderColor:GREEN,backgroundColor:GREEN},
  timelineLine:{width:2,flex:1,backgroundColor:'#e6dfda'},
  timelineLineComplete:{backgroundColor:GREEN},
  timelineCopy:{flex:1,paddingTop:2},
  timelineTitle:{fontSize:10,lineHeight:14,fontWeight:'700',color:'#9a8f88'},
  timelineTitleComplete:{color:INK},
  timelineCurrent:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:.8,color:RED,marginTop:3},
  orderItemRow:{minHeight:72,borderTopWidth:1,borderTopColor:'#eee7e2',paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10},
  orderItemImage:{width:52,height:52,borderRadius:12,backgroundColor:'#f6f2ef'},
  orderItemImagePlaceholder:{width:52,height:52,borderRadius:12,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},
  orderItemPrice:{fontSize:9,fontWeight:'900',color:INK},
  trackButton:{minHeight:48,borderRadius:24,backgroundColor:INK,marginTop:12,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  trackButtonText:{fontSize:7,fontWeight:'900',letterSpacing:1,color:'#fff'},
  orderTotals:{borderRadius:20,backgroundColor:'#f0ebe7',padding:16,marginTop:12},
  orderTotalRow:{minHeight:32,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  orderTotalValue:{fontSize:10,fontWeight:'800',color:INK},
  orderTotalFinal:{borderTopWidth:1,borderTopColor:'#d9cfc9',marginTop:8,paddingTop:12},
  orderGrandTotal:{fontSize:20,fontWeight:'900',color:INK},
   emptyState: {
     minHeight: 300,
     borderRadius: 24,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     alignItems: "center",
     justifyContent: "center",
     padding: 28,
     gap: 14,
     marginTop: 16,
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
   languageRow: {
     minHeight: 76,
     borderRadius: 18,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     padding: 16,
     flexDirection: "row",
     alignItems: "center",
     justifyContent: "space-between",
     marginTop: 12,
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
  languageActive: { borderColor: GREEN, backgroundColor: "#f1faf5" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#cfc3bd",
  },
  toggleRow: {
    minHeight: 78,
    borderBottomWidth: 1,
    borderBottomColor: "#e6ddd8",
    backgroundColor: "#fff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  notificationDisabled: { marginTop: 14, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: "#efc6cf", backgroundColor: "#fff4f6", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  notificationSettingsButton: { minHeight: 36, borderRadius: 11, backgroundColor: RED, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  notificationSettingsText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  notificationEnableButton: { minHeight: 48, marginVertical: 14, borderRadius: 14, backgroundColor: RED, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  notificationEnableText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  notificationError: { color: RED, fontSize: 12, lineHeight: 18, marginBottom: 10 },
   addressCard: {
     borderRadius: 20,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     padding: 16,
     marginVertical: 8,
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
  addressTop: { flexDirection: "row", gap: 10 },
  addressActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 14,
  },
  dangerText: { fontSize: 9, fontWeight: "900", color: RED },
   panel: {
     borderRadius: 22,
     borderWidth: 1,
     borderColor: LIGHT_GRAY,
     backgroundColor: "#fff",
     padding: 18,
     gap: 14,
     marginVertical: 14,
     shadowColor: INK,
     shadowOpacity: 0.06,
     shadowRadius: 10,
     shadowOffset: { width: 0, height: 4 },
     elevation: 2,
   },
  legalRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11 },
  legalDivider: { height: 1, backgroundColor: "#e7ded9" },
  resetSuccess: { minHeight: 320, borderRadius: 24, borderWidth: 1, borderColor: "#d9e7de", backgroundColor: "#fff", padding: 24, alignItems: "center", justifyContent: "center", gap: 13 },
  dialogBackdrop: { flex: 1, backgroundColor: "rgba(18,10,12,.62)", padding: 16, alignItems: "center", justifyContent: "center" },
   dialogCard: { width: "100%", maxWidth: 460, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: LIGHT_GRAY, padding: 22, shadowColor: INK, shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
   dialogIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: DARK_CREAM, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: LIGHT_GRAY },
   dialogDangerIcon: { backgroundColor: "rgba(230, 57, 70, 0.1)", borderColor: "rgba(230, 57, 70, 0.2)" },
  dialogTitle: { fontFamily: "serif", fontSize: 24, lineHeight: 29, fontWeight: "800", color: INK },
  dialogBody: { fontSize: 11.5, lineHeight: 18, color: "#716660", marginTop: 7 },
  dialogFields: { marginTop: 15, gap: 11 },
  dialogActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  dialogCancel: { flex: 1, minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: "#d9cec8", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dialogCancelText: { fontSize: 9, fontWeight: "900", letterSpacing: .45, color: INK },
  dialogConfirm: { flex: 1.25, minHeight: 50, borderRadius: 17, backgroundColor: INK, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dialogConfirmDanger: { backgroundColor: RED },
  dialogConfirmText: { fontSize: 9, fontWeight: "900", letterSpacing: .35, color: "#fff", textAlign: "center" },
  fullLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f3f1",
  },
  loadingShell: { width: "100%", maxWidth: 760, padding: 16, gap: 14 },
  loadingBrand: { width: 126, height: 24, alignSelf: "center" },
  loadingHero: { width: "100%", height: 238, borderRadius: 24 },
  loadingCard: { width: "100%", height: 220, borderRadius: 24 },
});
