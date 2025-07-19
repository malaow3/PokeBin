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
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  PS: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  PSTeambuilder: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  Teams: any;
  // biome-ignore lint/suspicious/noExplicitAny : provided by Showdown
  Dex: any;
}

export type { UnsafeWindow };
