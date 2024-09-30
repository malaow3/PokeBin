
function Watermark() {

    return (
        <div
            id="NOCOPY"
            style={{
                "font-size": '16px',
                // color: 'rgba(255, 255, 255, 0.6)',
                color: 'rgba(251, 173, 255, 0.6)',
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
                    height: "25px",
                    width: "25px",
                    "margin-right": "4px",
                    scale: 1.0,
                    opacity: 0.6
                }}
                alt="It's Spheal!"
            />
        </div>
    );
}

export default Watermark;
