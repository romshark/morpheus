package site

import _ "embed"

//go:embed examples/react_setup.html
var reactSetupHTML string

//go:embed examples/react_component.tsx.txt
var reactComponentTSX string

//go:embed examples/react_types.ts.txt
var reactTypesTS string
