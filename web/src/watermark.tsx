

function Watermark() {

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '25px',
                right: '50px',
                "font-size": '18px',
                color: 'rgba(255, 255, 255, 0.5)',
                "pointer-events": 'none',
                "z-index": 9999,
                "transform-origin": 'bottom right',
                "user-select": 'none',
                "-webkit-user-select": 'none',
                "-moz-user-select": 'none',
                "-ms-user-select": 'none',
                display: 'flex',
                "align-items": 'center',
                "white-space": 'nowrap'
            }}
        >
            PokeBin
            <
                img
                class="ml-1"
                src="/assets/favicon/android-chrome-192x192.png"
                style={{
                    height: "35px",
                    width: "35px",
                    "margin-right": "4px",
                    scale: 1.0
                }}
                alt="It's Spheal!"
            />
        </div>
    );
}

export default Watermark;
