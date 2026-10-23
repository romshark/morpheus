package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

var ifPlatformBranchHTML = renderExampleHTML(examples.IfPlatformBranch())

//go:embed examples/if_platform_branch.templ
var ifPlatformBranchTempl string

var ifPlatformMultipleHTML = renderExampleHTML(examples.IfPlatformMultiple())

//go:embed examples/if_platform_multiple.templ
var ifPlatformMultipleTempl string

var ifPlatformExcludeHTML = renderExampleHTML(examples.IfPlatformExclude())

//go:embed examples/if_platform_exclude.templ
var ifPlatformExcludeTempl string
