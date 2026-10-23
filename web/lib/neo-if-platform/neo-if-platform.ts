import { boolCommand } from "../command";
import { ConditionGate } from "../condition-gate";
import { currentPlatform, type Platform } from "../platform";

const PLATFORMS: readonly Platform[] = ["macos", "ios", "windows", "linux", "android", "chromeos"];

export class NeoIfPlatform extends ConditionGate {
	static observedAttributes = PLATFORMS;

	// A device has 1 platform, so the platforms set true are an OR and
	// x="false" excludes x. With none set true, every platform not excluded shows.
	protected holds(): boolean {
		const platform = currentPlatform();
		const own = platform === "other" ? null : boolCommand(this, platform);
		if (own !== null) return own;
		return !PLATFORMS.some((p) => boolCommand(this, p) === true);
	}
}

if (!customElements.get("neo-if-platform")) {
	customElements.define("neo-if-platform", NeoIfPlatform);
}
