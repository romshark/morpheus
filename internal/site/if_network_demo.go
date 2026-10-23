package site

import (
	_ "embed"

	"github.com/romshark/morpheus/internal/site/examples"
)

var ifNetworkStatusHTML = renderExampleHTML(examples.IfNetworkStatus())

//go:embed examples/if_network_status.templ
var ifNetworkStatusTempl string
