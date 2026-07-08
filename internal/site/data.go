package site

type Assignee struct {
	ID, Name string
}

type Member struct {
	ID, Name, Title, Avatar string
}

// Avatars made by https://getavataaars.com/
var members = []Member{
	{"diego_vega", "Diego Vega", "CFO", "avatar/avatar_1.svg"},
	{"jan_osullivan", "Jan O'Sullivan", "Lead Designer", "avatar/avatar_2.svg"},
	{"evelyn_kone", "Evelyn Kone", "Data Analyst", "avatar/avatar_3.svg"},
	{"samira_khalil", "Samira Khalil", "Head of Engineering", "avatar/avatar_4.svg"},
	{"alice_larsson", "Alice Larsson", "Product Manager", "avatar/avatar_5.svg"},
	{"camila_duarte", "Camila Duarte", "DevOps Engineer", "avatar/avatar_6.svg"},
	{"theo_becker", "Theo Becker", "UX Researcher", "avatar/avatar_7.svg"},
	{
		"mateusz_wisniewski", "Mateusz Wiśniewski", "Fullstack Engineer",
		"avatar/avatar_8.svg",
	},
}

var assignees = []Assignee{
	{"jane", "Jane Doe"},
	{"arturo", "Arturo Reyes"},
	{"priya", "Priya Shah"},
	{"kenji", "Kenji Nakamura"},
	{"lena", "Lena Voss"},
	{"omar", "Omar El-Hassan"},
	{"yuki", "Yuki Tanaka"},
}
