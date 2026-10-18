# 장원 차트 (자동 갱신 웹 버전)

브라우저 주소 하나로 PC·휴대폰 어디서나 여는 차트 프로그램입니다.
GitHub Actions가 매일 미국 장 마감 뒤 yfinance로 가격을 받아 두고, 차트는 열 때마다 새 데이터를 자동으로 가져옵니다.

## 설치 (처음 한 번, 약 10분)

1. **저장소 만들기**: GitHub → New repository → 이름 예: `jangwon-chart` → **Public** 선택 → Create.
   - 무료 계정에서 GitHub Pages는 Public 저장소만 됩니다. 관심 종목 목록과 가격 데이터가 공개된다는 점만 알아 두세요.
2. **파일 올리기**: 압축을 푼 폴더 안의 모든 파일·폴더를 저장소 화면(Add file → Upload files)에 끌어다 놓고 Commit.
   - `.github` 폴더가 꼭 올라가야 합니다. 안 보이면 아래 ‘문제 해결’ 1번을 보세요.
3. **쓰기 권한 주기**: Settings → Actions → General → 맨 아래 Workflow permissions → **Read and write permissions** → Save.
4. **웹사이트 켜기**: Settings → Pages → Source: **Deploy from a branch** → Branch: **main**, 폴더 **/(root)** → Save.
5. **첫 데이터 받기**: Actions 탭 → 왼쪽 `Update chart data` → **Run workflow**. 종목 40개 기준 3~5분.
6. **열기**: `https://<GitHub 아이디>.github.io/<저장소 이름>/` 을 PC와 휴대폰에서 즐겨찾기.
   - 휴대폰: 브라우저 메뉴 → ‘홈 화면에 추가’를 하면 앱처럼 열립니다.

## 매일 어떻게 돌아가나

- 평일 한국시간 **오전 6시 35분**(장 마감 뒤)과 **오전 10시 35분**(늦게 정정된 데이터 반영)에 자동으로 받습니다.
  GitHub 사정으로 몇 분~수십 분 늦게 시작할 수 있습니다.
- 차트 화면은 **열 때**, **열어 둔 동안 30분마다**, **다른 창에서 돌아올 때** 새 데이터를 확인합니다.
- 위쪽 ‘○/○ 마감 데이터’ 버튼을 누르면 마지막 갱신 시각, 실패한 종목, 서버에 없는 종목을 볼 수 있습니다.

## 종목 추가·삭제

- 저장소의 `config.json` → 연필 아이콘 → `symbols` 목록을 고쳐 Commit → 몇 분 안에 자동으로 받아집니다.
- 차트 프로그램에서 폴더를 바꿨다면: ‘○/○ 마감 데이터’ 버튼 → ‘관심 폴더를 config.json 형식으로 복사’ → GitHub의 config.json 내용을 모두 지우고 붙여넣기 → Commit.

## 데이터 기준

- 일봉: Yahoo Finance 가격, **주식 분할 반영**(배당 반영 안 함). 매번 10년치를 통째로 다시 받으므로 분할이 생겨도 과거 가격이 자동으로 맞춰집니다.
- 30분봉: Yahoo는 최근 60일만 주므로, 매일 이어 붙여 기간을 늘려 갑니다. 겹치는 시간의 가격이 바뀌면(분할 등) 새 데이터로 교체합니다.
- 시간은 미국 동부 시간 기준입니다(30분봉 09:30~15:30).

## 문제 해결

1. **`.github` 폴더가 업로드되지 않음**: 저장소에서 Add file → Create new file → 파일 이름에 `.github/workflows/update-data.yml` 입력 → 압축 파일 안 같은 이름 파일 내용을 붙여넣기 → Commit.
2. **Actions가 빨간색(실패)**: 실패한 실행을 눌러 로그 확인. `모든 종목이 실패했습니다`면 Yahoo가 잠시 막은 것이니 잠시 뒤 Run workflow를 다시 누르세요. `Permission denied`나 `403`이면 설치 3번(쓰기 권한)을 확인하세요.
3. **주소가 404**: Pages 설정 후 첫 배포까지 1~3분 걸립니다. Settings → Pages 위쪽에 주소가 표시되면 열립니다.
4. **새 데이터가 화면에 안 보임**: ‘○/○ 마감 데이터’ 버튼 → ‘지금 확인’. GitHub Pages는 반영까지 1~2분 걸릴 수 있습니다.
5. **60일 동안 저장소에 변화가 없으면** GitHub가 예약 실행을 멈춥니다. 데이터가 매일 커밋되므로 보통 문제없지만, 멈추면 Actions 탭에서 다시 켜세요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 차트 프로그램 |
| `config.json` | 자동 갱신할 종목과 폴더 |
| `scripts/update_data.py` | yfinance로 데이터를 받는 스크립트 |
| `.github/workflows/update-data.yml` | 매일 자동 실행 설정 |
| `data/` | 받은 가격 데이터 (자동 생성) |
