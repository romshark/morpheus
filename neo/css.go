package neo

// CSSUnit is a CSS size value: a number plus a unit, e.g. "1rem",
// "0px", "2em", "50%", "12ch", "40vh". Zero value means "unset".
// A few fields also accept a keyword such as "content"; see the field's own doc.
//
// https://www.w3schools.com/cssref/css_units.php
type CSSUnit = string
