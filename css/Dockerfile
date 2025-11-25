# 1) 가벼운 nginx 웹 서버 이미지 사용
FROM nginx:alpine

# 2) 루트에 있는 모든 .html 파일을 nginx 웹 루트로 복사
COPY ./*.html /usr/share/nginx/html/

# 3) css, js, images 폴더를 그대로 복사
COPY ./css /usr/share/nginx/html/css
COPY ./js /usr/share/nginx/html/js
COPY ./images /usr/share/nginx/html/images

# 4) 컨테이너에서 80번 포트 사용
EXPOSE 80
