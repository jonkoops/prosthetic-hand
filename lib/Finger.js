import IvansFinger from './IvansIndexFinger.js';

// Incrementing identifier for Fingers. Fingers can either keep the same ID for their life, or request a new ID whenever they go down.
let fingerIdSequence = 1;

// A function that returns `false`.
const falseFn = () => false;

// 🖐️class Finger
// Represents a finger, capable of performing synthetic gestures.

/*
🖐️example

```js
const hand = new Hand();
const finger = hand.growFinger();

finger
	.wait(500)
	.moveTo(200, 250, 0)
	.down()
	.moveBy(100, 150, 2000)
	.up();
```
*/
export default class Finger {
	// 🖐️factory Finger(pointerType?: String = 'mouse', options?: FingerOptions): Finger
	// Instantiates a new `Finger` of the given `pointerType` (either `'mouse'`, `'pen'` or `'touch'`).
	// For more information on the different pointer types, see the [`pointerType` property](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType).
	constructor(pointerType = 'mouse', options) {
		this._id = fingerIdSequence++;

		this._pointerType = pointerType;

		this._hand = options.hand;

		// 🖐️section FingerOptions
		// The internal state of a `Finger` has options which will be reflected as properties of the events fired afterwards.
		// Some of these state options apply only to a specific event mode.
		this._state = {
			// 🖐️option x: Number; The number of pixels from the left boundary the finger is at.
			x: 0,

			// 🖐️option y: Number; The number of pixels from the top boundary the finger is at.
			y: 0,

			// 🖐️option down: Boolean; Whether the finger is down or not.
			down: false,

			// 🖐️option pressure: Number = 0.5; The value for [`PointerEvent.pressure`](https://developer.mozilla.org/docs/Web/API/PointerEvent/pressure), between `0.0` and `1.0`
			pressure: 0.5,

			// 🖐️option tiltX: Number = 0; The value for [`PointerEvent.tiltX`](https://developer.mozilla.org/docs/Web/API/PointerEvent/tiltX)
			tiltX: 0,

			// 🖐️option tiltY: Number = 0; The value for [`PointerEvent.tiltX`](https://developer.mozilla.org/docs/Web/API/PointerEvent/tiltY)
			tiltY: 0,

			// 🖐️option width: Number = 25; The value for [`PointerEvent.width`](https://developer.mozilla.org/docs/Web/API/PointerEvent/width)
			width: 25,

			// 🖐️option radiusY: Number = 25; The value for [`PointerEvent.height`](https://developer.mozilla.org/docs/Web/API/PointerEvent/height)
			height: 25,

			...options,
		};

		// A "finger movement" is a plain hashmap that describes either a
		// instantaneous state change (e.g. "touch down", "up/lift touch",
		// "change pressure") or a movement("move", "wiggle", "vary pressure
		// during a few seconds").
		// A finger movement has three things:
		// * A duration (can be zero)
		// * A final finger state
		// * A function that returns the finger state (run when the movement is
		//   still running, i.e. the end timestamp is not reached yet)
		// These are called duration, finalState and getState().
		// getState() gets called with an amount of milliseconds since the last movement
		// getState() might return `false`, meaning 'nothing happened since last time'

		this._movements = [];

		// Timestamp for the end of the last movement.
		this._movesUntil = performance.now();

		// Timestamp for the start of the current movement. This is always in the past.
		this._movesFrom = performance.now();

		// Final state of the last movement (to calculate the next movement if needed).
		this._finalState = { ...this._state };

		// Initialize the graphic representation of the finger.
		if (this._pointerType === 'touch') {
			this._initGraphicIvansFinger();
		} else {
			this._initGraphicCircle();
		}
	}

	// 🖐️method isIdle(): Boolean
	// Returns true when the finger has no more pending movements/waits/wiggles/etc.
	isIdle() {
		return !this._movements.length;
	}

	// 🖐️method down(delay?: Number): this
	// Puts the finger down, optionally after a delay.
	down(delay) {
		return this.update({ down: true, getState: falseFn, duration: delay ?? 0 });
	}

	// 🖐️method up(delay?: Number): this
	// Lifts the finger up, after an optional delay.
	up(delay) {
		return this.update({
			down: false,
			getState: falseFn,
			duration: delay ?? 0,
		});
	}

	// 🖐️method wait(delay: Number): this
	// Don't move this finger for `delay` milliseconds.
	wait(delay) {
		this._queueMove({
			finalState: this._finalState,
			getState: falseFn,
			duration: delay,
		});
		return this;
	}

	// 🖐️method waitUntil(timestamp: Number): this
	// Don't move this finger until the given timestamp is reached.
	waitUntil(timestamp) {
		if (this._movements.length) {
			return this.wait(timestamp - this._movesUntil);
		}

		const move = {
			finalState: this._finalState,
			getState: this._falseFn,
			duration: timestamp - performance.now(),
			until: timestamp,
		};

		this._movesUntil = this._movesFrom = move.until;
		this._movements.push(move);

		this._hand.fingerIsBusy();

		return this;
	}

	// 🖐️method update(options: FingerOptions, delay?: Number): this
	// Updates some of the finger options, like pressure or touch angle,
	// without disturbing its movement, after an optional delay.
	update(options, delay) {
		this._queueMove({
			finalState: options,
			getState: this._falseFn,
			duration: delay ?? 0,
		});
		return this;
	}

	// 🖐️method moveTo(x: Number, y: Number, delay: Number): this
	// Queues moving this finger to an absolute position at `(x, y)`; the
	// movement will last for `delay` milliseconds.
	moveTo(x, y, delay) {
		return this.moveBy(x - this._finalState.x, y - this._finalState.y, delay);
	}

	// 🖐️method moveBy(x: Number, y: Number, delay: Number): this
	// Queues a move of this finger to an position relative to its last position
	// plus`(x, y)`; the movement will last for `delay` milliseconds.
	moveBy(x, y, delay) {
		const fromX = this._finalState.x;
		const fromY = this._finalState.y;

		const move = {
			finalState: {
				x: fromX + x,
				y: fromY + y,
			},

			getState: (function (x1, y1, dx, dy) {
				return function (msec) {
					const percent = msec / delay;
					return {
						x: Math.round(x1 + dx * percent),
						y: Math.round(y1 + dy * percent),
					};
				};
			})(fromX, fromY, x, y, delay),

			duration: delay,
		};

		this._queueMove(move);

		return this;
	}

	// Queues a movement
	_queueMove(move) {
		if (!this._movements.length) {
			this._movesUntil = this._movesFrom = performance.now();
		}

		move.until = this._movesUntil + move.duration;
		this._movements.push(move);

		this._finalState = move.finalState = {
			...this._finalState,
			...move.finalState,
		};

		this._movesUntil = move.until;

		if (this._movements.length === 1) {
			this._hand.fingerIsBusy();
		}
	}

	// Returns the timestamp when the next movement will be finished
	// 🖐️method getNextMoveEndTime(): Number|undefined
	getNextMoveEndTime() {
		if (!this._movements.length) {
			return;
		}
		return this._movements[0].until;
	}

	/*
	 * 🖐️method getEvents(timestamp?: Number, justOne: Boolean): []
	 * Updates the private properties of the finger (x, y, timestamp) by
	 * running the next movement(s) as far as indicated by the timestamp (or
	 * as fas as to `performance.now()`), then checks if the state has changed
	 * and means an event should be fired.
	 *
	 * If `justOne` is set to truthy, then this will run just one movements.
	 * Otherwise, it will run as many movements as needed until `timestamp` is reached.
	 *
	 * Returns an array of objects of the form `{type: 'foo', event: PointerEvent(...), finger: Finger}`
	 * with all pointer events triggered by executing moves until `timestamp`.
	 *
	 * If the finger doesn't matter when `getEvents()` is called, then an empty
	 * array is return instead. This happens for mice not moving, and fingers
	 * not touching (fingers touching but not moving, and mice not pressing
	 * but moving *do* matter).
	 *
	 * A `Hand` is responsible for getting events (using loops, timings, or
	 * whatever), requesting the right timestamps if needed,
	 * and firing the events via `dispatchEvent()`.
	 */
	getEvents(timestamp, justOne) {
		const now = timestamp ?? performance.now();
		let changed = false;
		const previousState = { ...this._state };

		// Process all moves that already happened (since last frame)
		while (
			this._movements.length &&
			this._movements[0].until <= now &&
			!(changed && justOne)
		) {
			const done = this._movements.shift();
			Object.assign(this._state, done.finalState);
			this._movesFrom = done.until;
			changed = true;
		}

		// Process ongoing movement
		if (this._movements.length && !(changed && justOne)) {
			const move = this._movements[0];
			const updatedState = move.getState(now - this._movesFrom);

			if (updatedState && !this._statesAreEqual(updatedState, this._state)) {
				changed = true;
				Object.assign(this._state, updatedState);
			}
		}

		if (!this._movements.length) {
			this._hand.fingerIsIdle();
		}

		let evType = 'idle';

		if (changed) {
			if (
				previousState.x !== this._state.x ||
				previousState.y !== this._state.y
			) {
				evType = 'move';
			}

			if (previousState.down && !this._state.down) {
				this._graphic.style.display = 'none';
				evType = 'up';
			} else if (!previousState.down && this._state.down) {
				this._graphic.style.display = 'block';
				evType = 'down';
			}

			this._setGraphicPosition(this._state.x, this._state.y);
		}

		if (evType === 'idle') {
			return [];
		}

		/// TODO: Check for pointerover/pointerout events, add them to the
		/// array.
		/// TODO: Create synthetic `click` and `dblclick` events if/when
		/// needed, add them to the array.
		return [
			{ type: evType, event: this._asPointerEvent(evType), finger: this },
		];
	}

	// 🖐️method private_asPointerEvent(): PointerEvent
	// Returns an instance of `PointerEvent` representing the current state of the finger
	_asPointerEvent(evType) {
		return new PointerEvent('pointer' + evType, {
			bubbles: true,
			button: 0, // Moz doesn't use -1 when no buttons are pressed, WTF?
			// 			buttons: this._state.down ? 1 : 0,
			//	 		detail: (evType === 'down' || evType === 'up') ? 1 : 0,	// TODO: count consecutive clicks
			clientX: this._state.x,
			clientY: this._state.y,
			screenX: this._state.x, /// TODO: Handle page scrolling
			screenY: this._state.y,
			pageX: this._state.x,
			pageY: this._state.y,
			pointerType: 'pen',
			pointerId: this._id,
			isPrimary: this._id === 1,
			width: this._state.width,
			height: this._state.height,
			tiltX: this._state.tiltX,
			tiltY: this._state.tiltY,
			pressure: this._state.pressure,
			// 			target: document.elementFromPoint(this._state.x, this._state.y),	// works with viewport coords
		});
	}

	// Inits this._graphic to be a SVG circle.
	_initGraphicCircle() {
		this._graphic = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'svg',
		);
		this._graphic.style.height = '50px';
		this._graphic.style.width = '50px';
		this._graphic.style.zIndex = 1000000; // Some ridiculously high value
		this._graphic.style.position = 'absolute';
		this._graphic.style.top = 0;
		this._graphic.style.left = 0;
		this._graphic.style.marginLeft = '-25px';
		this._graphic.style.marginTop = '-25px';
		this._graphic.style.pointerEvents = 'none';

		const circle = document.createElementNS(
			'http://www.w3.org/2000/svg',
			'circle',
		);
		circle.cx.baseVal.value = 25;
		circle.cy.baseVal.value = 25;
		circle.r.baseVal.value = 20;
		circle.style.stroke = 'rgba(0,0,0,0.3)';
		circle.style.strokeWidth = 2;
		circle.style.fill = 'rgba(0,0,0,0.1)';

		this._graphic.appendChild(circle);

		this._graphic.style.display = 'none';
		document.body.appendChild(this._graphic);
	}

	// Inits this._graphic to be an image of Ivan's index finger
	_initGraphicIvansFinger() {
		this._graphic = document.createElement('img');
		this._graphic.src = IvansFinger;
		this._graphic.style.height = '160px';
		this._graphic.style.width = '160px';
		this._graphic.style.zIndex = 1000000; // Some ridiculously high value
		this._graphic.style.position = 'absolute';
		this._graphic.style.top = 0;
		this._graphic.style.left = 0;
		this._graphic.style.marginLeft = '-20px';
		this._graphic.style.marginTop = '-20px';
		this._graphic.style.pointerEvents = 'none';

		this._graphic.style.display = 'none';
		document.body.appendChild(this._graphic);
	}

	_setGraphicPosition(x, y) {
		this._graphic.style.transform = `translate3d(${x}px, ${y}px, 0)`;
	}

	// Simple, non-deep comparison of hashmaps, used for comparing internal finger states.
	// Returns `false` when one of the properties of s1 differs from the same property
	// of s2 (or s2 doesn't have it). It ignores if s1 doesn't have all properties from
	// s2.
	_statesAreEqual(s1, s2) {
		for (let i in s1) {
			if (s1[i] !== s2[i]) {
				return false;
			}
		}
		return true;
	}
}
