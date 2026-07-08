// CSS modules imported as raw text (esbuild `text` loader, configured in
// build.ts) so shadow-DOM components can adopt them into a shadow root via
// scopeCssToHost. See neo-progress.ts for the canonical use.
declare module "*.css" {
	const css: string;
	export default css;
}
