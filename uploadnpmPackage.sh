# find 并批量上传
find . -type f -name '*.tgz'  | sed "s|^\./||" | xargs -P 50 -I '{}' \
curl -u "admin:Xhyh123$%^" -X 'POST' -v \
  http://192.168.20.100:8081/service/rest/v1/components?repository=npm-hosted \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'npm.asset=@{};type=application/x-compressed' ;