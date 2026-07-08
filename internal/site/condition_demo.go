package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

var conditionPlatformBranchHTML = renderExampleHTML(examples.ConditionPlatformBranch())

//go:embed examples/condition_platform_branch.templ
var conditionPlatformBranchTempl string

var conditionMultiplePlatformsHTML = renderExampleHTML(examples.ConditionMultiplePlatforms())

//go:embed examples/condition_multiple_platforms.templ
var conditionMultiplePlatformsTempl string
