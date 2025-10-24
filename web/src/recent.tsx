import {
    initSettings,
    type PackedPaste,
    getPackedPastes,
    removePackedPaste,
} from './settings';
import { Icons } from '@pkmn/img';
import { createEffect, createSignal, onMount, For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import './app.css';
import './recent.css';

function updateThemeColor(dark: boolean) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', dark ? '#000000' : '#f9f9f9');
}

const Recent = () => {
    const { sett: settings, setSett } = initSettings();
    const [rows, setRows] = createSignal<PackedPaste[]>([]);
    const [selected, setSelected] = createSignal<Set<string>>(new Set());

    function getPosition(pokemon: string) {
        const spriteInfo = Icons.getPokemon(pokemon, {
            protocol: 'https',
            domain: 'pokebin.com',
        });
        return `${spriteInfo.left}px ${spriteInfo.top}px`;
    }

    function handleSelect(id: string, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function handleDeleteSelected() {
        const ids = Array.from(selected());
        for (const id of ids) {
            removePackedPaste(id, settings, setSett);
        }
        setRows(getPackedPastes());
        setSelected(new Set<string>());
    }

    onMount(() => {
        const wsUrl = '/ws';
        const socket = new WebSocket(wsUrl);
        socket.onopen = async () => {
            console.log('WebSocket connected to:', wsUrl);
        };

        const dark = settings().darkMode;
        document.body.classList.toggle('dark', dark);
        document.body.classList.toggle('light', !dark);
        updateThemeColor(dark);

        document.title = 'Recent PokeBins';
        setRows(getPackedPastes());
    });

    createEffect(() => {
        const dark = settings().darkMode;
        document.body.classList.toggle('dark', dark);
        document.body.classList.toggle('light', !dark);
        updateThemeColor(dark);
    });

    return (
        <main class="min-h-screen flex flex-col items-center bg-[#f9f9f9] dark:bg-zinc-950 transition-colors">
            <h1 class="text-4xl font-bold mb-4">
                Recent <span class="text-[#c2a8d4]">PokeBins</span>
            </h1>
            <Show
                when={rows().length > 0}
                fallback={<div>No recent pastes.</div>}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleDeleteSelected();
                    }}
                    class="w-full max-w-3xl"
                >
                    <table class="w-full table-auto border-collapse recent-table">
                        <thead>
                            <tr>
                                <th class="p-2" />
                                <th class="p-2 text-left">Name</th>
                                <th class="p-2 text-left">Pokémon</th>
                                <th class="p-2 text-left">Format</th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={rows()}>
                                {(row) => (
                                    <tr class="border-b border-zinc-200 dark:border-zinc-800">
                                        <td class="p-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selected().has(row.id)}
                                                onInput={(e) =>
                                                    handleSelect(
                                                        row.id,
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                aria-label="Select for deletion"
                                            />
                                        </td>
                                        <td class="p-2">
                                            <a
                                                href={`/${row.id}`}
                                                class="text-xl font-bold text-[#c2a8d4] hover:underline"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {row.name}
                                            </a>
                                        </td>
                                        <td class="p-2">
                                            <div class="flex flex-row gap-1">
                                                <For each={row.pokemon}>
                                                    {(poke) => (
                                                        <span
                                                            class="pokemon-icon"
                                                            title={poke}
                                                            style={`background-position: ${getPosition(
                                                                poke,
                                                            )};`}
                                                        />
                                                    )}
                                                </For>
                                            </div>
                                        </td>
                                        <td class="p-2">{row.format}</td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                    <div class="mt-4 flex justify-end">
                        <button
                            type="submit"
                            class="px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600 disabled:opacity-50"
                            disabled={selected().size === 0}
                        >
                            Delete Selected
                        </button>
                    </div>
                </form>
            </Show>
        </main>
    );
};

const root = document.getElementById('root');
if (root) {
    render(() => <Recent />, root);
}
