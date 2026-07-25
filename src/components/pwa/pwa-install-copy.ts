/**
 * Text for the install invitation.
 *
 * The banner is shown on two surfaces that translate differently: the app,
 * under `[locale]`, uses next-intl, while the public landing uses its own
 * react-i18next instance. Passing the copy in keeps one component serving both
 * instead of forking the logic per i18n system.
 */
export interface PwaInstallCopy {
  title: string;
  body: string;
  install: string;
  later: string;
  dismiss: string;
  /** Shown instead of `body` on iOS, which has no install event. */
  iosBody: string;
  iosStepShare: string;
  iosStepAdd: string;
}
