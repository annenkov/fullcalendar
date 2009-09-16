
VER = `cat version.txt`
DATE = `svn info | grep Date: | sed 's/.*: //g'`
REV = `svn info | grep Rev: | sed 's/.*: //g'`

JS_SRC_FILES =\
	main.js\
	grid.js\
	view.js\
	util.js
	
CSS_SRC_FILES =\
	main.css\
	grid.css

OTHER_FILES =\
	src/gcal.js\
	src/jquery\
	examples\
	changelog.txt

zip:
	@rm -rf build/fullcalendar
	@rm -rf build/fullcalendar-*
	@mkdir -p build/fullcalendar
	
	@echo "building js & css..."
	@cd src; cat misc/head.txt ${JS_SRC_FILES} misc/foot.txt > ../build/fullcalendar/fullcalendar.js
	@cd src/css; cat ${CSS_SRC_FILES} > ../../build/fullcalendar/fullcalendar.css
	@for f in build/fullcalendar/*; do\
		sed -i "s/* FullCalendar/& v${VER}/" $$f;\
		sed -i "s/* Date:/& ${DATE}/" $$f;\
		sed -i "s/* Revision:/& ${REV}/" $$f;\
		done
	@cp -rt build/fullcalendar ${OTHER_FILES}
	@find build/fullcalendar -type d -name .svn | xargs rm -rf
	
	@echo "compressing js..."
	@java -jar build/yuicompressor-2.4.2.jar -o build/fullcalendar/fullcalendar.min.js build/fullcalendar/fullcalendar.js
	
	@echo "building examples..."
	@for f in build/fullcalendar/examples/*.html; do\
		sed -i -n '1h;1!H;$${;g;s/<!--\s*<src>.*<\/src>\s*-->\s*//g;p;}' $$f;\
		sed -i -n '1h;1!H;$${;g;s/<!--\s*<dist>\s*//g;p;}' $$f;\
		sed -i -n '1h;1!H;$${;g;s/<\/dist>\s*-->\s*//g;p;}' $$f;\
	done
	
	@echo "zipping..."
	@mv build/fullcalendar build/fullcalendar-${VER}
	@cd build; for f in fullcalendar-*; do\
		zip -q -r $$f.zip $$f;\
		done
	@mv build/fullcalendar-${VER} build/fullcalendar
	
	@mkdir -p dist
	@mv build/fullcalendar-${VER}.zip dist
	@echo "done."
	
clean:
	@rm -rf build/fullcalendar
	@rm -rf build/fullcalendar-*
	@rm -rf dist/*
	