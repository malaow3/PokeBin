import { createEffect, createSignal, onMount } from "solid-js";
import logo from "../public/logo/large_logo_cropped.webp";

function Watermark() {
  const [isFixed, setIsFixed] = createSignal(false);
  const [dir, setDir] = createSignal("shrink");
  const [prevSize, setPrevSize] = createSignal(window.innerWidth);
  const [height, setHeight] = createSignal("50px");
  const [width, setWidth] = createSignal("100px");
  const [bottom, setBottom] = createSignal("10px");
  const [padding, setPadding] = createSignal("0px");

  function check() {
    const aspectRatio = window.innerWidth / window.innerHeight;

    if (aspectRatio >= 1.84 && aspectRatio <= 1.87) {
      setWidth("75px");
      setHeight("35px");
      setBottom("55px");
    } else if (window.innerWidth <= 450) {
      setWidth("75px");
      setHeight("35px");
      setBottom("55px");
    } else if (window.innerWidth <= 1290) {
      setWidth("75px");
      setHeight("35px");
      setBottom("60px");
    } else if (window.innerWidth <= 1400) {
      setWidth("75px");
      setHeight("35px");
      setBottom("60px");
    } else {
      setBottom("20px");
      setPadding("15px");
    }
    if (window.innerWidth <= 1290) {
      if (dir() === "shrink") {
        setIsFixed(true);
      }
    } else {
      setIsFixed(false);
    }
  }

  onMount(() => {
    window.onresize = () => {
      if (window.innerWidth < prevSize()) {
        setDir("shrink");
        setPrevSize(window.innerWidth);
      } else {
        setDir("grow");
        setPrevSize(window.innerWidth);
      }
      check();
    };
    check();
  });

  createEffect(() => {
    check();
  });

  // return (
  //   <div
  //     id="NOCOPY"
  //     style={{
  //       position: isFixed() ? "fixed" : "relative",
  //       display: "flex",
  //       "flex-direction": isFixed() ? "column" : "row",
  //       "font-size": "32px",
  //       bottom: "30px",
  //       right: "10px",
  //       // color: 'rgba(255, 255, 255, 0.6)',
  //       color: "rgba(251, 173, 255, 0.75)",
  //       "pointer-events": "none",
  //       "z-index": 9999,
  //       "transform-origin": "bottom right",
  //       "user-select": "none",
  //       "-webkit-user-select": "none",
  //       "-moz-user-select": "none",
  //       "-ms-user-select": "none",
  //       "align-items": "center",
  //       "white-space": "nowrap",
  //       "margin-top": "20px",
  //       "margin-left": "20px",
  //     }}
  //   >
  //     <div class="flex flex-row justify-center align-middle items-center">
  //       <span>PokeBin</span>
  //       <img
  //         class="ml-1"
  //         src="/assets/favicon/android-chrome-192x192.png"
  //         style={{
  //           height: "32px",
  //           width: "32px",
  //           "margin-right": "4px",
  //           scale: 1.0,
  //           opacity: 0.75,
  //           top: "-2px",
  //         }}
  //         alt="It's Spheal!"
  //       />
  //     </div>
  //     <PatreonButton />
  //   </div>
  // );
  return (
    <div
      id="NOCOPY"
      style={{
        position: isFixed() ? "fixed" : "relative",
        display: "flex",
        bottom: bottom(),
        "padding-bottom": padding(),
        right: isFixed() ? "30px" : undefined, // Only set right when fixed
        left: isFixed() ? undefined : "30px", // Only set left when not fixed
        "flex-direction": isFixed() ? "column" : "row",
        "pointer-events": "none",
        "z-index": 9999,
        "transform-origin": "bottom right",
        "user-select": "none",
        "-webkit-user-select": "none",
        "-moz-user-select": "none",
        "-ms-user-select": "none",
        "align-items": "center",
        "white-space": "nowrap",
        width: "100px",
        height: "0px",
      }}
    >
      <img
        src={logo}
        style={{
          height: height(),
          width: width(),
          transform: "scale(1.5)", // 1.5x bigger visually
        }}
        class="border-none outline-none shadow-none"
        alt="PokeBin Logo"
      />
    </div>
  );
}

export default Watermark;
