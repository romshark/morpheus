package site

import _ "embed"

//go:embed examples/getting_started_install.html
var gettingStartedInstallHTML string

const gettingStartedInstallGo = `go get github.com/romshark/morpheus`
