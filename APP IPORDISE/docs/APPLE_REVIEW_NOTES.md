# Proposed Apple Review notes

Use this as the basis for the App Review Information notes. Replace bracketed owner actions in App Store Connect; do not commit credentials.

IPORDISE is a native React Native/Expo storefront for physical perfume products delivered in Morocco.

## Review access

- Home, Shop, search, product details, favourites, bag, Help, and checkout can be reviewed without signing in.
- To create an account: open **Account**, choose **Create account**, enter an email address and password, then follow the verification email if requested.
- Authenticated features include profile, saved addresses, synchronized favourites/bag, order history, preferences, data export, and account deletion.
- If a pre-populated account is needed for existing order history: **[ACCOUNT OWNER: create a dedicated reviewer account and enter its credentials only in App Store Connect Review Information.]**

## Shopping and checkout

1. Open **Shop** from the main navigation.
2. Select a perfume and size on Product Detail.
3. Add it to the bag and open **Bag**.
4. Continue to checkout, enter a valid Moroccan city, address, phone number, and email, then choose **Cash on delivery**.
5. Checkout creates a real physical-goods order for the IPORDISE fulfilment team. There is no digital content and no Apple In-App Purchase.

Reviewers should avoid placing a final order unless testing production fulfilment. If an order is submitted, add “APPLE REVIEW TEST — CANCEL” to the order note and use the dedicated reviewer details supplied in App Store Connect.

## Location-specific behavior

- Prices are shown in Moroccan dirhams (MAD).
- Delivery and phone validation are designed for Morocco.
- Payment is collected on delivery; the app does not collect payment-card information.

## Account deletion

While signed in, open **Account → Privacy & Security → Delete account**. The app explains the permanent effect, requires confirmation and the current password, calls the production deletion service, removes the account and associated personal account data, anonymizes retained order records, and signs out after success.

## Support and legal links

- Support: `https://ipordise.com/pages/support`
- Privacy policy: `https://ipordise.com/pages/privacy-policy`
- Terms: `https://ipordise.com/pages/terms`
- Account deletion: `https://ipordise.com/pages/account-deletion`

The app does not use advertising, cross-app tracking, push notifications, location, camera, microphone, contacts, Bluetooth, or third-party social login. Optional photo-library access is used only when the customer chooses a profile photo.
