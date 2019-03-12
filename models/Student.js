var mongoose = require('mongoose');

//创建schema
var studentSchema = new mongoose.Schema({
	"sid" 				: String,
	"name" 				: String,
	"grade" 			: String,
	"password" 			: String,
	"changedPassword"   : {type : Boolean , default : false},
	"mycourses"			: [String]
});

//接受一个参数，是表格上传的那个6项的数组
studentSchema.statics.importStudent = function(workSheetsFromFile){
	var str = "ABDEFGHJKLMNPQRTUVWXYZabdefghijkmnpqrtuvwxyz23456789&$%#@!";
	var gradeArr = ["初一","初二","初三","高一","高二","高三"];
	//删除原来的全表！直接操作数据库，一条语句搞定！
	mongoose.connection.collection("students").drop(function(){
		//添加新表：
		for(var i = 0 ; i < 6 ; i++){
			for(var j = 1 ; j < workSheetsFromFile[i].data.length ; j++){
				//这个人的明文密码：
				var password = "";
				for(var m = 0 ; m < 6 ; m++){
					password += str.charAt(parseInt(str.length * Math.random()));
				}
				var s = new Student({
					"sid" : workSheetsFromFile[i].data[j][0],
					"name" : workSheetsFromFile[i].data[j][1],
					//grade是年级，1初一、2初二、3初三、4高一、5高二、6高三
					"grade" : gradeArr[i],
					//裁剪为小纸条给学生下发
					"password" : password
				}); 
				s.save();
			}
		}
	});
}

//创建模型
var Student = mongoose.model("Student",studentSchema);

module.exports = Student;

