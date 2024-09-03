import "./base.css";

function PatreonButton() {

    return (
        <div style="user-select: none !important">
            <a
                class="patreon-button"
                href="https://patreon.com/malaow3"
                target="_blank"
            >
                <img
                    width="16"
                    height="16"
                    class="octicon rounded-2 d-block"
                    alt="patreon"
                    src="https://github.githubassets.com/assets/patreon-96b15b9db4b9.svg"
                />
                <span class="ml-2">Support on Patreon</span>
            </a>
        </div>
    );
}

export default PatreonButton;
