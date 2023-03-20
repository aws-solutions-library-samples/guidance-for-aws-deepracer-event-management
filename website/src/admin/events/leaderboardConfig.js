import i18next from '../../i18n';

export const qrCodeIsVisibleoptions = () => {
  return [
    { label: i18next.t('events.leaderboard.qr-code-visible'), value: 'true' },
    { label: i18next.t('events.leaderboard.qr-code-hidden'), value: 'false' },
  ];
};

export const GetQrCodeLabelFromBoolean = (value) => {
  console.info(value);
  if (value == null) return;
  const options = qrCodeIsVisibleoptions();
  const item = options.find((item) => item.value.toString() === value.toString());
  if (item) {
    return item.label;
  }
  return i18next.t('events.leaderboard.qr-code-hidden');
};

export const GetQrCodeOptionFromBoolean = (value) => {
  if (value == null) return;
  const options = qrCodeIsVisibleoptions();
  const item = options.find((item) => item.value.toString() === value.toString());
  if (item) {
    return item;
  }
  return undefined;
};
