import type { Settings } from './settings';
import type { JSX } from 'solid-js';

type SettingsFormProps = {
    settings: Settings;
    onChange: (key: keyof Settings, value: boolean | number) => void;
    children?: JSX.Element;
};

export function SettingsForm(props: SettingsFormProps) {
    return (
        <div class="flex flex-col gap-2 w-80">
            <div class="flex flex-row items-center gap-4">
                <label for="newFormat" class="font-medium cursor-pointer w-60">
                    New paste format
                </label>
                <input
                    id="newFormat"
                    name="newFormat"
                    type="checkbox"
                    class="align-middle"
                    checked={!!props.settings.newFormat}
                    onChange={(e) =>
                        props.onChange('newFormat', e.target.checked)
                    }
                />
            </div>
            <div class="flex flex-row items-center gap-4">
                <label for="colors" class="font-medium cursor-pointer w-60">
                    Move colors
                </label>
                <input
                    id="colors"
                    name="colors"
                    type="checkbox"
                    class="align-middle"
                    checked={props.settings.moveColors}
                    onChange={(e) =>
                        props.onChange('moveColors', e.target.checked)
                    }
                />
            </div>
            <div class="flex flex-row items-center gap-4">
                <label for="twoDImages" class="font-medium cursor-pointer w-60">
                    2D images
                </label>
                <input
                    id="twoDImages"
                    name="twoDImages"
                    type="checkbox"
                    class="align-middle"
                    checked={props.settings.twoDImages}
                    onChange={(e) =>
                        props.onChange('twoDImages', e.target.checked)
                    }
                />
            </div>
            <div class="flex flex-row items-center gap-4">
                <label for="darkMode" class="font-medium cursor-pointer w-60">
                    Dark Mode
                </label>
                <input
                    id="darkMode"
                    name="darkMode"
                    type="checkbox"
                    class="align-middle"
                    checked={props.settings.darkMode}
                    onChange={(e) =>
                        props.onChange('darkMode', e.target.checked)
                    }
                />
            </div>
            <div class="flex flex-row items-center gap-4">
                <label for="lastViewed" class="font-medium cursor-pointer w-60">
                    Last viewed pastes count
                </label>
                <input
                    id="lastViewed"
                    name="lastViewed"
                    type="number"
                    min={0}
                    max={25}
                    class="w-20 rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-700 dark:text-white"
                    value={props.settings.lastViewedCount}
                    onChange={(e) =>
                        props.onChange(
                            'lastViewedCount',
                            Number.parseInt(e.target.value),
                        )
                    }
                />
            </div>
            {props.children}
        </div>
    );
}
