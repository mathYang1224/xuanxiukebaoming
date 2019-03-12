var formidable = require("formidable");
var fs = require("fs");
var Course = require("../models/Course.js");
var mongoose = require("mongoose");
var url = require("url");

exports.showAdminCourse = function(req,res){
    res.render("admin/course",{
        page : "course"
    });
}
exports.showAdminCourseImport = function(req,res){
    res.render("admin/course/import",{
        page : "course"
    });
}

exports.showAdminCourseAdd = function(req,res){
    res.render("admin/course/add",{
        page : "course"
    });
}


//执行导入JSON数据，进入数据库。这不是Ajax上传接口，是一个同步表单上传接口。
exports.doAdminCourseImport = function(req,res){
	var form = new formidable.IncomingForm();
	//设置一个上传路径
	form.uploadDir = "./uploads";
	form.keepExtensions = true;
    form.parse(req, function(err, fields, files) {
        if(err){
            res.send("上传失败！请检查！");
            return;
        }
    	//得到你上传的这个文件，发出读取请求
        fs.readFile(files.coursejson.path,function(err,data){
            if(err){
                    res.send("上传失败！请检查！");
                    return;
                }
            var dataobj = JSON.parse(data.toString());
            //先删除数据表
            mongoose.connection.collection("courses").drop(function(){
                //读的内容插入数据库
                Course.insertMany(dataobj.courses,function(err,r){
                    if(err){
                        res.send("上传失败！请检查！");
                        return;
                    }
                    res.send("恭喜！成功导入" + r.length + "条课程信息！");
                });
            }); 
        });
    });
}



//全部学生的数据，被jqGrid限制了API形式。
//并且这个接口是用GET请求发送来的
//如同： course?_search=false&nd=1490872998973&rows=2&page=1&sidx=sid&sord=asc
exports.getAllCourse = function(req,res){
    //拿到参数
    var rows = url.parse(req.url,true).query.rows;  //一页多少条目
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
                {"cid": regexp},
                {"name": regexp},
                {"teacher": regexp},
                {"briefintro": regexp}
            ]
        }
    }

    //分页算法，得到总页数
    Course.count(findFiler,function(err,count){
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
        Course.find(findFiler).sort(sortobj).limit(rows).skip(rows * (page - 1)).exec(function(err,results){
            res.json({"records" : count, "page" : page, "total" : total , "rows" : results});
        });
    });
}



//修改某个课程
exports.updateCourse = function(req,res){
    //得到表单的信息，这部分信息是jQuery通过Ajax发送的
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        //要更改的键名
        var key = fields.cellname;
        //要更改的键的值
        var value = fields.value;
        //课程编号
        var cid = fields.cid;
        //真的更改
        Course.find({"cid" : cid} , function(err,results){
            if(err){
                res.send({"result" : -2});  //-2表示数据库错误
                return;
            }
            if(results.length == 0){
                res.send({"result" : -1});  //-1表示查无此人，无法更改
                return;
            }
            //得到学生
            var thecourse = results[0];
            //改
            thecourse.name = fields.name;
            thecourse.dayofweek = fields.dayofweek;
            thecourse.number = fields.number;
            thecourse.allow = fields.allow.split(",");
            thecourse.teacher = fields.name;
            thecourse.briefintro = fields.briefintro;
            //持久化
            thecourse.save(function(err){
                if(err){
                    res.send({"result" : -2});  //-2表示数据库错误
                    return;
                }

                res.send({"result" : 1});   //1表示成功
            });
        });
    });
}

exports.removeCourse = function(req,res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        //直接命令模块做事情，删除元素。
        Course.remove({"cid" : fields.arr},function(err,obj){
            if(err){
                res.json({"result" : -1});
            }else{
              
                res.json({"result" : obj.result.n});
            }
        })
    });
}


//增加课程
exports.addCourse = function(req,res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        if(err){
            res.json({"result" : -1});      //-1表示服务器错误
            return;
        }
        var cid = fields.cid;
        //⑤ 验证学号是否冲突
        Course.count({"cid" : cid},function(err,count){
            if(err){
                res.json({"result" : -1});
                return;
            }
            if(count != 0){
                res.json({"result" : -3});  //-3表示用户名被占用
                return;
            }


            var c = new Course({
               cid : fields.cid,
               name : fields.name,
               dayofweek : fields.dayofweek,
               allow : fields.allow,
               number : fields.number,
               teacher : fields.teacher,
               briefintro : fields.briefintro
               
            });
            c.save(function(err){
                if(err){
                    res.json({"result" : -1});
                    return;
                }
                res.json({"result" : 1});
            });
        });
    });
}
