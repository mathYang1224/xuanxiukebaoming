exports.showAdminDashborad = function(req,res){
	res.render("admin/index",{
		page : "index"
	});
}

exports.showAdminReport = function(req,res){
	res.render("admin/report",{
		page : "report"
	});
}