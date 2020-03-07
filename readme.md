# pd-svg

`<pd-svg>` is a [html custom element](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) that (only) renders a puradata [patch](https://puredata.info/docs/developer/PdFileFormat) in [svg](https://developer.mozilla.org/en-US/docs/Web/SVG).

![screenshot](screenshot.png?raw=true)

> note: screenshot is for world-white-web, but pd-svg supports css (color) variables and example-usage.html uses [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme). and to set that in firefox, go to `about:config` and add a new number `ui.systemUsesDarkTheme` with `1` or `0`.

currently pd-svg only renders these pd _things_:

- canvas _(please dont use more than one >.<*)_
- object
- message
- connect _(lazy and with workaround guessing...)_

## show-stoppers

- pd-patch has no info how many in/out ports an element has...
- pd-patch position/sizes are "hard-coded" to font size...
