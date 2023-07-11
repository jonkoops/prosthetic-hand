import Finger from './Finger.js';

const TimingMode = {
	Interval: 'INTERVAL',
	Minimal: 'MINIMAL',
	Instant: 'INSTANT',
	Frame: 'FRAME',
	FastFrame: 'FAST_FRAME',
};

// 🖐️class Hand
// Represents a set of `Finger`s, capable of performing synthetic touch gestures.

/*
🖐️example

```js
const hand = new Hand({ timing: '20ms' });
```

*/
export default class Hand {
	// 🖐️factory Hand(options?: HandOptions): Hand
	// Instantiates a new `Hand` with the given options.
	constructor(options = {}) {
		this._fingers = [];
		this._fingersAreIdle = true;

		/// TODO: Timing modes: minimal, interval, frames

		// 🖐️option timing: Timing = '20ms'
		// Defines how often new events will be fired, in one of the possible
		// timing modes

		// 🖐️miniclass Timing (Hand)
		this._timeInterval = 20;
		this._timingMode = TimingMode.Interval;
		this._framesPending = 0;

		if (options.timing) {
			const timing = options.timing.toString();

			// 🖐️option ms
			// Preceded by a number (e.g. `'20ms'`), this mode triggers an event
			// dispatch every that many milliseconds.
			if (timing.match(/^\d+ms$/)) {
				this._timingMode = TimingMode.Interval;
				this._timeInterval = parseInt(timing);
			}

			// 🖐️option frame
			// This mode dispatches an event every [animation frame](https://developer.mozilla.org/docs/Web/API/Window/requestAnimationFrame).
			if (timing === 'frame') {
				this._timingMode = TimingMode.Frame;
				this._timeInterval = parseInt(timing);
			}

			// 🖐️option minimal
			// This mode triggers an event dispatch per finger change, and ensures
			// that every move can trigger its own event (no two movements will be
			// rolled into one event if they are very close).
			if (timing === 'minimal') {
				this._timingMode = TimingMode.Minimal;
				this._timeInterval = false;
			}

			// 🖐️option instant
			// Like the `minimal` mode, but ignores timings completely and dispatches
			// all events instantaneously. This might cause misbehaviour in graphical
			// browsers, and the `onStart` and `onStop` callbacks will be called at.
			// every step of the movement (as the movement ends before the next step
			// is chained in)
			if (timing === 'instant') {
				this._timingMode = TimingMode.Instant;
				this._timeInterval = false;
			}

			// 🖐️option fastframe
			// This mode ignores timings completely like the `instant` mode, and
			// dispatches a new event every so many frames.
			if (timing === 'fastframe') {
				this._timingMode = TimingMode.FastFrame;
				this._timeInterval = parseInt(timing);
			}
		}

		// 🖐️class Hand

		// 🖐️option onStart: Function
		// If set to a callback function, it will be called (with the `Hand`
		// as its only argument) whenever the movements start.
		if (options.onStart) {
			this._onStart = options.onStart;
		}

		// 🖐️option onStop: Function
		// If set to a callback function, it will be called (with the `Hand`
		// as its only argument) whenever the movements are completed.
		if (options.onStop) {
			this._onStop = options.onStop;
		}

		// Cancellable reference to the next call to `_dispatchEvents`. This
		// might be either a `setTimeout` reference or a `requestAnimationFrame`
		// reference.
		this._nextDispatch = null;
	}

	// 🖐️method growFinger(eventMode, options): Finger
	// Creates a new `Finger` with the same parameters as the [`Finger` constructor](#finger-finger),
	// and adds it to the hand.
	growFinger(fingerMode, options = {}) {
		Object.assign(options, { hand: this });

		const finger = new Finger(fingerMode, options);

		this._fingers.push(finger);
		return finger;
	}

	// 🖐️method fingerIsBusy(): this
	// Used by this hand's fingers to signal that there are movements to be
	// performed by at least one finger.
	fingerIsBusy() {
		/// TODO: Start up the event loop

		if (this._fingersAreIdle) {
			// 🖐️section
			// Use `document.addEventListener('prostheticHandStop', fn)` to
			// do stuff with it.
			// 🖐️event prostheticHandStart: CustomEvent
			// Fired when all movements are complete.
			document.dispatchEvent(
				new CustomEvent('prostheticHandStart', { target: this }),
			);

			if (this._onStart && this._onStart instanceof Function) {
				this._onStart(this);
			}

			this._fingersAreIdle = false;
			this._scheduleNextDispatch();
		}

		return this;
	}

	// 🖐️method fingerIsIdle(): this
	// Used by this hand's fingers to signal that one finger has finished doing
	// all the queued movements.
	fingerIsIdle() {
		if (this._fingers.every((f) => f.isIdle())) {
			this._fingersAreIdle = true;
		}
	}

	// 🖐️method sync(delay): this
	// Synchronizes the finger movements by adding a delay of **at least** `delay`
	// milliseconds to each finger. After a sync, the movements of the fingers
	// will happen at exactly the same time.
	sync(delay) {
		let endTimestamp = performance.now();

		this._fingers.forEach((f) => {
			const movesUntil = f._movesUntil;
			if (movesUntil) {
				endTimestamp = Math.max(endTimestamp, movesUntil);
			}
		});

		const waitUntil = endTimestamp + delay;

		this._fingers.forEach((f) => {
			f.waitUntil(waitUntil);
		});
	}

	// 🖐️method private_dispatchEvents(): this
	// Updates all the fingers, fetching their events/touchpoints, and dispatches
	// all `Event`s triggered by the update.
	// This is meant to be called on an internal timer.
	_dispatchEvents(timestamp) {
		// 🖐️event prostheticHandTick: CustomEvent
		// Fired a movement is about to start, just before the mouse/touch/pointer
		// events are fired.
		document.dispatchEvent(
			new CustomEvent('prostheticHandStart', { target: this }),
		);

		const now = timestamp || performance.now();
		const fast =
			this._timingMode === TimingMode.Minimal ||
			this._timingMode === TimingMode.Instant ||
			this._timingMode === TimingMode.FastFrame;

		// Fire all events for all fingers.
		for (const finger of this._fingers) {
			const events = finger.getEvents(now, fast);

			for (const event of events) {
				document
					.elementFromPoint(event.clientX, event.clientY)
					.dispatchEvent(event.event);
			}
		}

		this._scheduleNextDispatch();

		return this;
	}

	_scheduleNextDispatch() {
		if (this._fingersAreIdle) {
			// 🖐️event prostheticHandStop: CustomEvent
			// Fired when all movements are complete.

			document.dispatchEvent(
				new CustomEvent('prostheticHandStop', { target: this }),
			);

			if (this._onStop && this._onStop instanceof Function) {
				this._onStop(this);
			}
		} else {
			// Calculate time for next movement end. Could be refactored out for
			// some timing modes.
			let min = Infinity;
			this._fingers.forEach((f) => {
				if (!f.isIdle()) {
					const next = f.getNextMoveEndTime();
					// 						console.log('next:', next);
					if (next < min) {
						min = next;
					}
				}
			});

			if (this._timingMode === TimingMode.Interval) {
				this._nextDispatch = setTimeout(
					this._dispatchEvents.bind(this),
					this._timeInterval,
				);
			} else if (this._timingMode === TimingMode.Minimal) {
				this._nextDispatch = setTimeout(
					this._dispatchEvents.bind(this),
					min - performance.now(),
				);
			} else if (this._timingMode === TimingMode.Instant) {
				return this._dispatchEvents(min);
			} else if (this._timingMode === TimingMode.Frame) {
				this._nextDispatch = requestAnimationFrame(
					this._dispatchEvents.bind(this),
				);
			} else if (this._timingMode === TimingMode.FastFrame) {
				this._nextDispatch = requestAnimationFrame(
					function () {
						this._dispatchEvents(min);
					}.bind(this),
				);
			}
		}
	}
}
