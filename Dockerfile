# 1) Node.js 가벼운 베이스 이미지
FROM node:22-alpine

# 2) 작업 디렉터리 설정
WORKDIR /app

# 3) 패키지 정보만 먼저 복사 후 설치
COPY package*.json ./
RUN npm install

# 4) 나머지 소스 전체 복사
COPY . .

# 5) 서버 포트 오픈 (server.js: 3000)
EXPOSE 3000

# 6) 컨테이너 시작 시 실행할 명령
CMD ["node", "server.js"]
