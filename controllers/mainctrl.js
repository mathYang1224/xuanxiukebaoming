var formidable = require("formidable");
var Student = require("../models/Student.js");
var Course = require("../models/Course.js");
var crypto = require("crypto");
var _ = require("underscore");

exports.showLogin = function(req,res){
	res.render("login");
}

//执行登录
exports.doLogin = function(req,res){
	//有两种情况：根据 "changedPassword" : false还是true，来决定：
	//false：用户没有更改密码，此时直接和数据库中比较password字段是否完全一致即可。
	//true：用户已经更改了密码，此时数据库中存储的是MD5加密之后的密码

	var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
    	if(err){
    		res.json({"result" : -1});	//-1表示服务器错误
    		return;
    	}
    	var sid = fields.sid;			//用户输入的用户名
    	var password = fields.password;	//用户输入的密码

    	//① 先查询有没有这个学生
    	Student.find({"sid" : sid},function(err,results){
    		if(err){
	    		res.json({"result" : -1});	//-1表示服务器错误
	    		return;
    		}

    		if(results.length == 0){
    			res.json({"result" : -2});	//-2表示没有这个学生
	    		return;
    		}

    		//② 看看这个人是否已经修改过密码
    		var changedPassword = results[0].changedPassword;
    		if(!changedPassword){
    			//如果这个人没有修改过默认密码，则直接和数据库中的密码进行===匹配。
    			if(results[0].password === password){
                    //你成功了，给你发个session
                    req.session.login = true;
                    //在session中记录学号
                    req.session.sid = sid;
                    //存储name
                    req.session.name = results[0].name;
                    //存储这个人是否已经更改过密码
                    req.session.changedPassword = false;
                    //这个这个人的年级
                    req.session.grade = results[0].grade;
                    //两条语句不能颠倒顺序
    				res.json({"result" : 1});	//1表示登录成功
	    			return;
    			}else{
    				res.json({"result" : -3});	//-3表示密码错误
    				return;
    			}
    		}else{
    			//如果这个人修改过密码，则要将用户输入的密码进行sha256加密之后与数据库中的密码进行匹配。
    		    if(results[0].password === crypto.createHash("sha256").update(password).digest("hex")){
                     //你成功了，给你发个session
                    req.session.login = true;
                    //在session中记录学号
                    req.session.sid = sid;
                    //存储name
                    req.session.name = results[0].name;
                    //存储这个人是否已经更改过密码
                    req.session.changedPassword = true;
                    //这个这个人的年级
                    req.session.grade = results[0].grade;
                    res.json({"result" : 1});   //1表示登录成功
                    return;
                }else{
                    res.json({"result" : -3});  //-3表示密码错误
                    return;
                }
            }
    	});
    });
}


//显示报名表格
exports.showIndex = function(req,res){
    //登录验证！如果你没有携带login的session
    if(req.session.login != true){
        res.redirect("/login");
        return;
    }

    //如果用户没有改过密码，这里还是不允许看首页！要强制跳转到更改密码页面（不转不行！）
    if(req.session.changedPassword == false){
        res.redirect("/changepw");
        return;
    }

    //呈递首页
    res.render("index",{
        //从session中得到sid。session的机理对程序员透明的，
        //我们之前只需要设置过session：  req.session.sid = sid;
        //此时就能拿出来。至于原理如何，编程的时候不需要考虑。面试的时候才考虑。 
        "sid" : req.session.sid,
        "name" : req.session.name,
        "grade" : req.session.grade
    });
}


exports.doLogout = function(req,res){
    req.session.login = false;
    req.session.sid = "";
    res.redirect("/login");
}


//更改密码
exports.showChangepw = function(req,res){
    //登录验证！如果你没有携带login的session
    if(req.session.login != true){
        res.redirect("/login");
        return;
    }

    res.render("changepw",{
        "sid" : req.session.sid,
        "name" : req.session.name,
        //是否显示tip条：
        "showtip" : !req.session.changedPassword
    });
}


//更改密码
exports.doChangepw = function(req,res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var pw = fields.pw;

        //更改密码，更改密码一定要记住，不能保存用户的明码，一定要加密
        Student.find({"sid" : req.session.sid},function(err,results){
            var thestudent = results[0];
            //更改过密码
            thestudent.changedPassword = true;
            //重写session
            req.session.changedPassword = true;
            //保存更改后的密码
            thestudent.password = crypto.createHash("sha256").update(pw).digest("hex");
            //持久
            thestudent.save();
            res.json({"result" : 1});
        });
    });
}


//检查课程是否能报名，这个函数真的很强大！！决定了index页面上的课程按钮的形态、文本、是否可用
exports.check = function(req,res){
    //登录验证！如果你没有携带login的session
    if(req.session.login != true){
        res.redirect("/login");
        return;
    }
    var results = {};

    //找到我这个人
    Student.find({"sid" : req.session.sid},function(err,students){
        var thestudent = students[0];
        //已经报名的课程序号数组
        var mycourses = thestudent.mycourses;
        //学生的年级
        var grade = thestudent.grade;
        //已经被占用的星期
        var occupyWeek = [];

        //查询所有课程，查询一次
        Course.find({},function(err,courses){
            //需要查询一次，但是需要遍历两次。
            //第一次遍历是看清全局信息，这个学生报名的课程有哪些？都占用了哪些日子？
            //第二次遍历是带着第一次遍历的结果，回答这门课能不能报名的信息。
            //遍历所有课程
            courses.forEach(function(item){
                if(mycourses.indexOf(item.cid) != -1){
                    //已经被占用的星期
                    occupyWeek.push(item.dayofweek);
                }
            });
            
            //比如，cidMapDayofweek就是["周二","周三"]

            courses.forEach(function(item){
                if(mycourses.indexOf(item.cid) != -1){
                    //如果已经报名了这个课程
                    results[item.cid] = "已经报名此课";
                }else if(occupyWeek.indexOf(item.dayofweek) != -1){
                    //如果这个课课程星期已经被占用
                   results[item.cid] = "当天被占用";
                }else if(item.number <= 0){
                    //如果人数不够了
                    results[item.cid] = "人数不够了";
                }else if(item.allow.indexOf(grade) == -1){
                    //如果年级不符合要求
                   results[item.cid] =  "年级不符合要求";
                }else if(occupyWeek.length == 2){
                    //如果年级不符合要求
                   results[item.cid] =  "已达报名上限";
                }else{
                   results[item.cid] = "可以报名";
                }
            });

            res.json(results);
        });
    });
}

//报名
exports.baoming = function(req,res){
    //学号
    var sid = req.session.sid;
    //要报名的课程编号
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var cid = fields.cid;

        Student.find({"sid" : sid },function(err,students){
            students[0].mycourses.push(cid);
            students[0].save(function(){
                Course.find({"cid" : cid} , function(err,courses){
                    courses[0].mystudents.push(sid);
                    courses[0].number --;
                    courses[0].save(function(){
                        res.json({"result" : 1});
                    })
                })
            });
        });
    });
}

//退报
exports.tuibao = function(req,res){
    //学号
    var sid = req.session.sid;
    //要报名的课程编号
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        var cid = fields.cid;

        Student.find({"sid" : sid },function(err,students){
            students[0].mycourses = _.without(students[0].mycourses,cid);
            students[0].save(function(){
                Course.find({"cid" : cid} , function(err,courses){
                    courses[0].mystudents = _.without(courses[0].mystudents,sid);
                     courses[0].number++;
                    courses[0].save(function(){
                        res.json({"result" : 1});
                    })
                })
            });
        });
    });
}