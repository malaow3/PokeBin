import { createEffect, createSignal, onMount } from "solid-js";

function Watermark() {

    const [isFixed, setIsFixed] = createSignal(false);

    function check() {
        if (window.innerWidth < 1200) {
            setIsFixed(true);
        } else {
            setIsFixed(false);
        }
    }

    onMount(() => {
        window.onresize = () => {
            check();
        };
        check();
    });

    createEffect(() => {
        check();
    });


    return (
        <div
            id="NOCOPY"
            style={{
                position: isFixed() ? 'fixed' : 'relative',
                "font-size": '32px',
                bottom: '10px',
                right: '10px',
                // color: 'rgba(255, 255, 255, 0.6)',
                color: 'rgba(251, 173, 255, 0.75)',
                "pointer-events": 'none',
                "z-index": 9999,
                "transform-origin": 'bottom right',
                "user-select": 'none',
                "-webkit-user-select": 'none',
                "-moz-user-select": 'none',
                "-ms-user-select": 'none',
                display: 'flex',
                "align-items": 'center',
                "white-space": 'nowrap',
                "margin-top": "0px",
                "margin-left": "10px"
            }}
        >
            PokeBin
            <
                img
                class="ml-1"
                src="/assets/favicon/android-chrome-192x192.png"
                style={{
                    height: "32px",
                    width: "32px",
                    "margin-right": "4px",
                    scale: 1.0,
                    opacity: 0.75
                }}
                alt="It's Spheal!"
            />
        </div>
    );
}

export default Watermark;
