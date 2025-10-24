import PatreonButton from './patreon';
import { onMount } from 'solid-js';
import './app.css';
import { render } from 'solid-js/web';

const About = () => {
    onMount(() => {
        const wsUrl = '/ws';
        const socket = new WebSocket(wsUrl);
        socket.onopen = async () => {
            console.log('WebSocket connected to:', wsUrl);
        };
    });
    return (
        <>
            <div class="container mx-auto px-4" style={{ color: 'white' }}>
                <div class="max-w-3xl mx-auto py-2">
                    <h1 class="text-4xl font-bold mb-4">
                        About <span class="text-[#c2a8d4]">PokeBin</span>
                    </h1>
                    <p class="text-lg mb-4">
                        Welcome! PokeBin was created as an alternative to
                        PokePaste. As a developer, I did this with three ideas
                        in mind:
                        <br />
                    </p>
                    <ol class="ml-10">
                        <li>
                            I'm passionate about Pokemon and the community! I'm
                            always looking for ways to help others grow and
                            enjoy the game!
                        </li>
                        <li>
                            I sensed that the PokePaste project is in an
                            archived state with little activity and no response
                            to pull requests.
                        </li>
                        <li>
                            I've been in contact with others who play and
                            appreciate Pokemon and are helping me (suggestions,
                            ideas, and support) to build a new and valuable
                            community!
                        </li>
                    </ol>
                    <br />
                    <p class="">
                        As always, if you come across any bugs, kindly notify me
                        through{' '}
                        <a
                            href="https://github.com/malaow3/PokeBin/issues"
                            class="text-sky-500"
                            rel="noreferrer"
                            target="_blank"
                        >
                            GitHub
                        </a>{' '}
                        - your ideas are always welcome and thanks again for
                        checking out PokeBin!
                    </p>
                    <p class="">
                        Feel free to also take a look at our{' '}
                        <a
                            href="/tos"
                            class="text-sky-500"
                            rel="noreferrer"
                            target="_blank"
                        >
                            Terms of Use
                        </a>
                        !
                    </p>
                    <br />
                    <br />
                    <p>
                        As you can appreciate, hosting a site isn't free! If you
                        find PokeBin to be a useful resource, please consider
                        supporting on Patreon!
                        <br />
                        <br />
                        Additionally, if you'd like to advertise on PokeBin,
                        feel free to reach out via email to at
                        <a href="mailto:malaow3@yahoo.com">malaow3@yahoo.com</a>
                    </p>
                    <br />
                    <PatreonButton />
                    <br />
                    <p>
                        I've also been working on a new project, PlotBot! Feel
                        free to check out the details below! If you subscribe to
                        my Patreon, you not only support PokeBin's continued
                        development and hosting but you also get access to
                        PlotBot!
                    </p>
                    <a
                        class="text-sky-500"
                        href="https://www.patreon.com/posts/introducing-104234417"
                        rel="noreferrer"
                        target="_blank"
                    >
                        Check out my latest project, PlotBot!
                    </a>
                    <br />
                    <br />
                    <a class="text-sky-500" href="/">
                        Return to PokeBin
                    </a>
                </div>
            </div>

            <style>{`
        li {
          list-style: disc;
          margin-left: 0;
          padding-left: 1em;
          text-indent: -1em;
        }
      `}</style>
        </>
    );
};

const root = document.getElementById('root');
if (root) {
    render(() => <About />, root);
}
