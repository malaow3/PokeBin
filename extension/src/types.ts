interface UnsafeWindow extends Window {
  toID: (str: string) => string;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  BattleFormats: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  room: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  $: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  Storage: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  app: any;
}

export type { UnsafeWindow };
