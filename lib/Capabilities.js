// Detects some browser capabilities. Only for internal use, not exposed to the
// API user.

// eventConstructors
// `true` if the browser can run `new Event()`.
// If `false`, then the library will resort to the (deprecated) `window.createEvent()`
// and `event.initMouseEvent()`. This is needed for legacy browsers and PhantomJS.
export let eventConstructors = true;

try {
	let foo = new Touch({ identifier: 0, target: document });
	// 	var foo = new MouseEvent();
} catch (e) {
	eventConstructors = false;
}

// mouseEventConstructor, for MouseEvent
export let mouseEventConstructor = true;

try {
	let foo = new MouseEvent("mousedown");
} catch (e) {
	mouseEventConstructor = false;
}

// touchConstructor, for Touch
export let touchConstructor = true;

try {
	let foo = new Touch({ identifier: 0, target: document });
} catch (e) {
	touchConstructor = false;
}

// touchEventConstructor, for TouchEvent
// Weirdly, Safari on iOS has Touch constructor but no TouchEvent constructor.
export let touchEventConstructor = true;

try {
	let foo = new TouchEvent("touchdown");
} catch (e) {
	touchEventConstructor = false;
}

// pointerEventConstructor, for PointerEvent
export let pointerEventConstructor = true;

try {
	let foo = new PointerEvent("pointerdown");
} catch (e) {
	pointerEventConstructor = false;
}

// mouse: `true` if the browser implements `MouseEvent`
export let mouse = !!("MouseEvent" in window);

// touch: `true` if the browser implements `TouchEvent`
export let touch = !!("TouchEvent" in window);

// pointer: `true` if the browser implements `PointerEvent`
export let pointer = !!("PointerEvent" in window);

// Some bits borrowed from Leaflet's L.Browser

let ua = navigator.userAgent.toLowerCase(),
	webkit = ua.indexOf("webkit") !== -1,
	phantomjs = ua.indexOf("phantom") !== -1,
	chrome = ua.indexOf("chrome") !== -1;

export let safari = !chrome && !phantomjs && ua.indexOf("safari") !== -1;
