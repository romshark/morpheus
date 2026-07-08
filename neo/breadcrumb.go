package neo

// BreadcrumbItem describes one entry in a Breadcrumb trail.
// An empty Href marks the item as the current page (rendered as a
// non-link with aria-current="page"); typically only the last item.
type BreadcrumbItem struct {
	Label string
	Href  string
}
