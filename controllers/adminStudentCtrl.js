var formidable = require('formidable');
var path = require("path");
var fs = require("fs");
var url = require("url");
var xlsx = require('node-xlsx');
var Student = require("../models/Student.js");
var dateformat = require('date-format');

exports.showAdminStudent = function(req,res){
    res.render("admin/student",{
        page : "student"
    });
}

exports.showAdminStudentExport = function(req,res){
    res.render("admin/student/export",{
        page : "student"
    });
}


exports.showAdminStudentImport = function(req,res){
    res.render("admin/student/import",{
        page : "student"
    });
}

exports.showAdminStudentAdd = function(req,res){
    res.render("admin/student/add",{
        page : "student"
    });
}
//增加学生
exports.addStudent = function(req,res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if(err){
            res.json({"result" : -1});      //-1表示服务器错误
            return;
        }
        //验证数据有效性

        //① 验证学号必须是9位数字
        var sid = fields.sid;
        //验证9位是不是满足
        if(!/^[\d]{9}$/.test(sid)){
            res.send({"result" : -2});      //-2表示用户名不合规范
            return;
        }

        //② 验证姓名是否合法
        var nameTxt = fields.name;
        //验证
        if(!/^[\u4E00-\u9FA5]{2,5}(?:·[\u4E00-\u9FA5]{2,5})*$/.test(nameTxt)){
            res.send({"result" : -4});      //-4表示用户名不合规范
            return;
        }


        //③ 验证年级是否合法
        //年级
        var grade = fields.grade
        //验证
        if(!grade){
            res.json({"result" : -5});  //-5表示年级没有选择
            return;
        }

        //④ 验证密码强度
        //姓名
        var password = fields.password;
        //验证
        if(checkStrength(password) != 3){
            res.json({"result" : -6});  //密码强度有问题
            return;
        }


        //上网抄的正则密码强度验证http://www.cnblogs.com/yjzhu/p/3394717.html
        function checkStrength(password){
            //积分制
            var lv = 0;
            if(password.match(/[a-z]/g)){lv++;}
            if(password.match(/[0-9]/g)){lv++;}
            if(password.match(/(.[^a-z0-9])/g)){lv++;}
            if(password.length < 6){lv=0;}
            if(lv > 3){lv=3;}

            return lv;
        }

        //⑤ 验证学号是否冲突
        Student.count({"sid" : sid},function(err,count){
            if(err){
                res.json({"result" : -1});
                return;
            }
            if(count != 0){
                res.json({"result" : -3});  //-3表示用户名被占用
                return;
            }


            var s = new Student({
                sid    : fields.sid,
                name   : fields.name,
                grade  : fields.grade,
                password : fields.password
            });
            s.save(function(err){
                if(err){
                    res.json({"result" : -1});
                    return;
                }
                res.json({"result" : 1});
            });
        });
    });
}


//执行表格的上传
exports.doAdminStudentImport = function(req,res){
	var form = new formidable.IncomingForm();
	form.uploadDir = "./uploads";
	form.keepExtensions = true;
    form.parse(req, function(err, fields, files) {
    	if(!files.studentexcel){
    		res.send("对不起，请上传文件！");
    	}
    	//检查拓展名是否正确
    	if(path.extname(files.studentexcel.name) != ".xlsx"){
    		//删除这个不正确的文件
    		fs.unlink("./" + files.studentexcel.path,function(err){
    			if(err){
    				console.log("删除文件错误");
    				return;
    			}
    			res.send("对不起，上传的文件类型不正确，你上传的已经从服务器删除");
    		});
    		return;
    	}

    	//读取这个Excel表格了，这是一条同步语句，所以没有回调函数
    	//workSheetsFromFile是一个数组
    	var workSheetsFromFile = xlsx.parse("./" + files.studentexcel.path);
    	//检查数组是不是符合规范
    	if(workSheetsFromFile.length != 6){
    		res.send("系统检查到你的Excel表格缺少子表格");
    		return;
    	}
    	//循环检查每个表的表头是否完整
    	for(var i = 0 ; i < 6 ; i++){
    		if(
    			workSheetsFromFile[i].data[0][0] != "学号" ||
    			workSheetsFromFile[i].data[0][1] != "姓名" 
    		){
    			res.send("系统检查到你的Excel表格" + i + "号子表的表头不正确，请保证6个年级的子表的表头都有“学号”、“姓名”");
    			return;
    		}
    	}
    	//至此，我们认为workSheetsFromFile数组是一个合法的数据了！
    	//命令Mongoose将数据存储到数据库中！
    	Student.importStudent(workSheetsFromFile);

    	//输出
    	res.send("上传成功！");
    });
}


//全部学生的数据，被jqGrid限制了API形式。
//并且这个接口是用GET请求发送来的
//如同： student?_search=false&nd=1490872998973&rows=2&page=1&sidx=sid&sord=asc
exports.getAllStudent = function(req,res){
    //拿到参数
    var rows = url.parse(req.url,true).query.rows;
    var page = url.parse(req.url,true).query.page;
    var sidx = url.parse(req.url,true).query.sidx;
    var sord = url.parse(req.url,true).query.sord;
    var keyword = url.parse(req.url,true).query.keyword;

    //排序方式，1asc，-1表示desc
    var sordNumber = sord == "asc" ? 1 : -1;

    //根据是否有keyword的GET请求参数，来决定一接口两用。
    //如果用户传了keyword，此时表示模糊查询
    //如果用户没有传keyword，此时表示全部查询
    if(keyword === undefined || keyword == ""){
        var findFiler = {}; //空对象，检索全部
    }else{
        //我们使用正则表达式的构造函数来将字符串转为正则对象
        //我们发现eval也同样好用var regexp = eval("/" + keyword + "/g");
        //★★★★★★★★★★★★★★★★★★★★★★★★★
        //模糊查询最有价值语句：MVS， most valuble statement
        var regexp = new RegExp(keyword , "g");
        //★★★★★★★★★★★★★★★★★★★★★★★★★
        var findFiler = {
            $or : [
                {"sid": regexp},
                {"name": regexp},
                {"grade": regexp}
            ]
        }
    }

    //分页算法，得到总页数
    Student.count(findFiler,function(err,count){
        //总页数，等于文档总数除以每页的行数，向上取整
        var total = Math.ceil(count / rows);
        //排序、分页
        //参考了博客：http://blog.csdn.net/zk437092645/article/details/9345885
        var sortobj = {};
        //动态绑定一个键，执行之后成为形如：{"sid" : -1}
        sortobj[sidx] = sordNumber;
        //这是一个结合了排序、分页的大检索
        //为什么要暴露records、page、total、rows这些键，都是jqGrid要求的
        //请看     http://blog.mn886.net/jqGrid/ ，  左侧点击新手demo
        //它的API：http://blog.mn886.net/jqGrid/JSONData

        //模糊查询，全字段查询，不管检索什么字段，都可以检索出来
        //或的逻辑。要么id匹配，要么是name
        Student.find(findFiler).sort(sortobj).limit(rows).skip(rows * (page - 1)).exec(function(err,results){
            res.json({"records" : count, "page" : page, "total" : total , "rows" : results});
        });
    });
}


//修改某个学生
exports.updateStudent = function(req,res){
    //学号
    var sid = parseInt(req.params.sid);
    //得到表单的信息，这部分信息是jQuery通过Ajax发送的
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        //要更改的键名
        var key = fields.cellname;
        //要更改的键的值
        var value = fields.value;

        //真的更改
        Student.find({"sid" : sid} , function(err,results){
            if(err){
                res.send({"result" : -2});  //-2表示数据库错误
                return;
            }
            if(results.length == 0){
                res.send({"result" : -1});  //-1表示查无此人，无法更改
                return;
            }
            //得到学生
            var thestudent = results[0];
            //改
            thestudent[key] = value;
            //持久化
            thestudent.save(function(err){
                if(err){
                    res.send({"result" : -2});  //-2表示数据库错误
                    return;
                }

                res.send({"result" : 1});   //1表示成功
            });
        });
    });
}



//propfind类型接口，检查学生是否存在
exports.checkStudentExist = function(req,res){
    //拿到参数
    var sid = parseInt(req.params.sid);
    if(!sid){
        res.json({"result" : -1});
        return;
    }
    //分页算法，得到总页数
    Student.count({"sid" : sid},function(err,count){
        if(err){
             res.json({"result" : -1});
             return;
        }
        res.json({"result" : count});
    });
};


exports.removeStudent = function(req,res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        //直接命令模块做事情，删除元素。
        Student.remove({"sid" : fields.arr},function(err,obj){
            if(err){
                res.json({"result" : -1});
            }else{
              
                res.json({"result" : obj.result.n});
            }
        })
    });
}


//下载全部学生表格
exports.downloadStudentXlsx = function(req,res){
    var TableR = [];
    var gradeArr = ["初一","初二","初三","高一","高二","高三"];
    

    //迭代器！强行把异步函数变为同步的！当读取完毕初一的时候，才去读取初二……
    //i为0、1、2、3、4、5，表示读取初一、初二……高三的信息
    function iterator(i){
        if(i == 6){
            //此时TableR中已经是6个年级的大数组了！
            var buffer = xlsx.build(TableR);
            //生成一个文件，我们将文件名设置的漂亮一点，是当前的时间
            //
            var filename = dateformat('学生清单yyyy年MM月dd日hhmmssSSS', new Date());
            fs.writeFile("./public/xlsx/" + filename + ".xlsx",buffer,function(err){
                //重定向！让用户的这次HTTP请求不再指向http://127.0.0.1:3000/admin/student/download
                //而是直接跳转到这个xlsx文件上
                res.redirect("/xlsx/" + filename + ".xlsx");
            });
            return;
        }
         //整理数据
        Student.find({"grade":gradeArr[i]},function(err,results){
            var sheetR = [];
            results.forEach(function(item){
                sheetR.push([
                    item.sid,
                    item.name,
                    item.grade,
                    item.password
                ]);
            });

            TableR.push({"name" : gradeArr[i], data : sheetR});
            //迭代！
            iterator(++i);
        });
    }

    iterator(0);
}