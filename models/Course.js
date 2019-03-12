var mongoose = require('mongoose');

//创建schema
var courseSchema = new mongoose.Schema({
	"cid" 			: String,		//字符串的好处是方便正则表达式的筛选
	"name" 			: String,
	"dayofweek" 	: String,
	"number" 		: Number,
	"allow" 		: [String],
	"teacher" 		: String,
	"briefintro"	: String,
	"mystudents"    : [String]
});

//创建模型
var Course = mongoose.model("Course",courseSchema);

module.exports = Course;

