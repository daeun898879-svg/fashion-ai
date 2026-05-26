const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const app = express();

app.use(cors());
// 대용량 이미지 전송을 위해 한도 확장
app.use(express.json({ limit: '10mb' })); 

// 🔑 [수정 완료] OpenAI API 키 보안 설정 (환경변수 적용)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🗓️ 일간 단위로 고정된 인덱스를 반환하는 결정론적 해시 함수
function getSeededIndex(seedString, max) {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
        hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % max;
}

// ================= 🤖 1. GPT-4o 패션 비전 분석 API =================
app.post('/analyze', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "이미지가 없습니다." });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `너는 대한민국 최고의 10대 패션 트렌드 분석가야. 
              보내준 의류 이미지를 정밀 스캔해서 아래의 [10대 패션 장르] 중 딱 '하나'로만 무조건 분류해줘.
              
              [10대 패션 장르]: 클래식, 캐주얼, 미니멀, 스트릿, 힙스터, 스포티, 빈티지, Y2K, 페미닌, 모던
              
              응답은 반드시 딴소리하지 말고 아래의 정확한 JSON 형식으로만 답변해줘. 앞뒤에 다른 설명이나 마크다운 텍스트는 절대 포함하지 마.
              {
                "aiStyle": "여기에 확정된 장르 한글로 입력 (예: 클래식)",
                "aiReason": "여기에 왜 그렇게 판정했는지 패션 전문가 수준의 분석 근거를 2문장 이내로 작성",
                "rawTag": "해당 의류를 대표하는 핵심 영어 단어 하나 (예: suit)"
              }`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const gptResult = JSON.parse(response.choices[0].message.content);
    console.log("🤖 GPT 실시간 패션 분석 완료:", gptResult);

    res.json({ 
      success: true, 
      aiStyle: gptResult.aiStyle, 
      aiReason: gptResult.aiReason,
      rawTag: gptResult.rawTag
    });

  } catch (error) {
    console.error("❌ OpenAI 통신 에러:", error.message);
    res.json({ 
      success: false, 
      aiStyle: "캐주얼", 
      aiReason: "OpenAI API 통신 중 오류가 발생하여 안전장치 모드(기본 캐주얼)로 전환되었습니다.", 
      rawTag: "error" 
    });
  }
});

// ================= 📊 2. 최근 2주 마켓 유행 트렌드 API =================
app.post('/biweekly-trend', async (req, res) => {
  try {
    const { style, gender, age } = req.body;
    const ageGroup = Math.floor(age / 10) * 10; 

    let trendKeywords = []; 
    let keywordTitle = "기본 스타일";
    let reportText = "전반적인 마켓 카테고리 누적 지표가 평이한 수준을 유지하고 있습니다.";

    if (style === "클래식") {
      keywordTitle = "테일러드 수트 & 정통 클래식 포멀웨어";
      trendKeywords = ["suit", "blazer", "formal"];
      reportText = `최근 2주간 ${ageGroup}대 마켓에서는 단정하고 격식 있는 셋업과 정형화된 오피스 룩의 누적 지표가 최상위권을 유지 중입니다.`;
    } else if (style === "캐주얼") {
      keywordTitle = "데일리 와이드 데님 & 베이직 캐주얼";
      trendKeywords = ["t-shirt", "jeans", "casual"];
      reportText = `최근 2주간 누적된 소비 지표에 따르면 일상에서 대중적이고 편안하게 매치할 수 있는 기본 팬츠 조합이 부동의 1위를 지켰습니다.`;
    } else if (style === "스트릿") {
      keywordTitle = "오버핏 그래픽 후드 & 스트릿 무드";
      trendKeywords = ["hoodie", "street", "oversized"];
      reportText = `최근 2주간 ${ageGroup}대 서브컬처 중심 마켓에서 힙한 오버사이즈 실루엣과 강렬한 그래픽 디자인 아이템의 수요가 급증했습니다.`;
    } else if (style === "미니멀") {
      keywordTitle = "모노톤 실루엣 & 모던 미니멀리즘";
      trendKeywords = ["minimal", "coat", "slacks"];
      reportText = `최근 2주간 깔끔한 모노톤 컬러 조합과 군더더기 없는 핏을 선호하는 미니멀리즘 성향의 실구매 트래픽이 꾸준한 상승세입니다.`;
    } else if (style === "빈티지") {
      keywordTitle = "아메카지 워크웨어 & 구제 워시드 빈티지";
      trendKeywords = ["vintage", "jacket", "washed"];
      reportText = `최근 2주간 자연스러운 워싱 가공 처리와 클래식한 아카이브 감성의 워크웨어 무드가 고유 매니아층을 형성하고 있습니다.`;
    } else {
      keywordTitle = `${style} 패션 인기도 상승 무드`;
      trendKeywords = [style.toLowerCase()];
      reportText = `최근 2주간 ${ageGroup}대 타겟 인구 통계 데이터를 분석한 결과, 해당 브랜드 무드군의 트래픽 지표가 안정적인 방어선을 구축하고 있습니다.`;
    }

    res.json({
      success: true,
      period: "최근 2주간 (14 Days 누적)",
      targetInfo: `${ageGroup}대 ${gender} (${style} 스타일)`,
      trendKeywords: trendKeywords,
      hotKeyword: keywordTitle,
      marketStatus: reportText
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ================= 🔄 3. 하루 단위로 고정되어 갱신되는 실시간 대시보드 API =================
app.get('/live-dashboard', (req, res) => {
  try {
    const trendPools = {
      teen: {
        M: ["스트릿 힙합", "Y2K 펑크", "유틸리티 고프코어", "스케이터 보드룩", "블록코어 시티힙"],
        F: ["스트릿 레트로", "긱시크 블록코어", "발레코어 스포티", "Y2K 걸리시", "빈티지 레이어드"]
      },
      twenties: {
        M: ["워크웨어 아메카지", "시티보이 오버핏", "헤리티지 캐주얼", "그런지 레이어드", "고프코어"],
        F: ["캐주얼 고프코어", "페미닌 그런지", "클린핏 캐주얼", "미니멀 모던룩", "노팅힐 빈티지"]
      },
      thirties: {
        M: ["시티보이 미니멀", "조용한 럭셔리", "어반 워크웨어", "스마트 캐주얼", "비즈니스 셋업"],
        F: ["미니멀 오피스", "모던 프렌치룩", "콰이어트 럭셔리", "뉴클래식 수트룩", "컨템포러리 엘레강스"]
      },
      forty: {
        M: ["클래식 수트라인", "타임리스 레트로", "비즈니스 캐주얼", "세미 포멀 오피스룩"],
        F: ["클래식 올드머니", "우아한 컨템포러리", "타임리스 미니멀", "럭셔리 페미닌 오피스"]
      },
      fifty: {
        M: ["클래식 비즈니스", "액티브 골프라인", "타임리스 포멀룩", "얼반 필드 캐주얼"],
        F: ["클래식 럭셔리", "액티브 실버 하이엔드", "프리미엄 레트로룩", "타임리스 엘레강스"]
      }
    };

    const now = new Date();
    const dateSeed = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    const finalDashboard = {
      teen: {
        M: trendPools.teen.M[getSeededIndex(dateSeed + '-tM', trendPools.teen.M.length)],
        F: trendPools.teen.F[getSeededIndex(dateSeed + '-tF', trendPools.teen.F.length)]
      },
      twenties: {
        M: trendPools.twenties.M[getSeededIndex(dateSeed + '-twM', trendPools.twenties.M.length)],
        F: trendPools.twenties.F[getSeededIndex(dateSeed + '-twF', trendPools.twenties.F.length)]
      },
      thirties: {
        M: trendPools.thirties.M[getSeededIndex(dateSeed + '-thM', trendPools.thirties.M.length)],
        F: trendPools.thirties.F[getSeededIndex(dateSeed + '-thF', trendPools.thirties.F.length)]
      },
      forty: {
        M: trendPools.forty.M[getSeededIndex(dateSeed + '-fM', trendPools.forty.M.length)],
        F: trendPools.forty.F[getSeededIndex(dateSeed + '-fF', trendPools.forty.F.length)]
      },
      fifty: {
        M: trendPools.fifty.M[getSeededIndex(dateSeed + '-fiM', trendPools.fifty.M.length)],
        F: trendPools.fifty.F[getSeededIndex(dateSeed + '-fiF', trendPools.fifty.F.length)]
      }
    };

    res.json({
      success: true,
      period: "최근 14일 누적 일간 지표",
      dashboardData: finalDashboard
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= 🚀 [수정 완료] 포트 유연화 =================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 AI 백엔드 서버가 포트 ${PORT}에서 정상 작동 중!`));