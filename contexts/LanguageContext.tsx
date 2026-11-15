import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'om';

const translations = {
  en: {
    home: 'Home', scan: 'Scan Buna', batches: 'Batches', station: 'Station',
    credits: 'Station credits', scanSample: 'Scan Sample', quality: 'Quality Grade',
    value: 'Estimated Value', certificate: 'Batch Certificate', red: 'Red Cherry',
    green: 'Green Bean', defect: 'Defect Rate', disclaimer: 'AI-assisted visual assessment only. Not an official ECX laboratory or Q-Grader certificate.',
    scanHistory: 'Scan History', totalBatches: 'Total Batches', language: 'Language',
    coffeeIntelligence: 'Coffee quality intelligence', changeLanguage: 'Change language',
    yourStation: 'YOUR WASHING STATION', availableScans: 'Available scans',
    averageQuality: 'AVERAGE QUALITY', completedScans: 'From completed AI scans',
    noAiScans: 'No AI scans yet', aiQualityCheck: 'AI-ASSISTED QUALITY CHECK',
    scanYourCoffee: 'Scan your coffee', captureAssess: 'Capture cherries or green beans to assess quality.',
    stationOverview: 'Station overview', yourActivity: 'YOUR ACTIVITY',
    savedOnDevice: 'Saved on this device', aiAssessments: 'AI assessments',
    cloudAssessments: 'Completed cloud scans', recentBatches: 'Recent batches',
    viewAll: 'View all', batchHistoryStarts: 'Your batch history starts here',
    firstBatchHint: 'Capture a coffee sample to create your first quality record.',
    startFirstScan: 'Start first scan', pending: 'Pending', jimmaZone: 'JIMMA ZONE',
    scanTitle: 'Scan Buna', scanSubtitle: 'Capture a sample for quality assessment',
    fieldLighting: 'Use bright, even light. Fill the frame with one representative coffee sample and avoid shadows.',
    selectSampleType: '1. Select sample type', redCherries: 'Red cherries',
    greenBeans: 'Green beans', coffeeOrigin: '2. Coffee origin', woreda: 'Woreda',
    lotWeight: '3. Lot weight (kg)', lotWeightHint: 'Enter the total weight of the lot. 1 Feresula = 17 kg.',
    captureSample: '4. Capture sample', cameraHint: 'Keep the sample centered and evenly lit',
    enableCamera: 'Enable camera', cameraPermission: 'Camera access is requested only when needed',
    captureAndAssess: 'Capture and assess sample', chooseGallery: 'Choose photo from gallery',
    demoTitle: 'Try a demonstration', demoOnly: 'DEMO ONLY',
    demoHint: 'Presets demonstrate the report layout. They do not analyse your photograph.',
    cleanDemo: 'Grade 1 clean', defectDemo: 'Grade 3 defects',
    invalidWeight: 'Invalid lot weight', invalidWeightHint: 'Enter a lot weight between 0.1 and 100,000 kg.',
    savedForLater: 'Saved for later', offlineQueue: 'You are offline. The sample image has been added to the local queue. Connect to the internet to submit it for AI grading.',
    registerStation: 'Register your station', registerStationHint: 'Sign in and register a washing station before grading real photographs. The demo presets are available without an account.',
    savedForRetry: 'Saved for retry', retryHint: 'The server response could not be confirmed. The sample is stored locally and will retry with the same capture ID when synchronization is available.',
    gradingFailed: 'Grading failed', noBatches: 'No batches yet. Scan your first sample.',
    searchBatch: 'Search batch or woreda', searchBatchId: 'Search batch ID or woreda',
    allRecords: 'All records', aiOnly: 'AI assessments', demo: 'Demo',
    records: 'records', record: 'record', noMatches: 'No matching records',
    tryDifferentSearch: 'Try a different search or filter.',
    noBatchesYet: 'No batches recorded yet',
    batchHistoryHint: 'Your saved coffee samples and assessments will appear here.',
    scanFirstSample: 'Scan first sample', batchHistory: 'Batch history',
    redCoffeeCherries: 'Red coffee cherries', greenCoffeeBeans: 'Green coffee beans',
    synced: 'SYNCED', local: 'LOCAL', demoLabel: 'DEMO',
    manageStation: 'Manage your washing station', signInRegister: 'Sign in / Register station',
    manageAccount: 'Manage cloud account', connectStation: 'Connect a station to enable real AI grading',
    accountAccess: 'Account and station access', scanCredits: 'SCAN CREDITS',
    proActive: 'PRO ACTIVE', payAsYouGo: 'PAY AS YOU GO',
    availableCredits: 'Available scan credits', starterPack: 'Starter Pack · 50 scans · 500 ETB',
    proPlan: 'Washing Station Unlimited · 2,500 ETB / month',
    refreshBalance: 'Refresh server balance', stationProfile: 'Station profile',
    originContact: 'Origin and contact details', save: 'Save', edit: 'Edit',
    stationName: 'Station name', manager: 'Manager', stationWoreda: 'Woreda',
    accountDemo: 'Local demo mode', noCloudBalance: 'No cloud station balance is connected.',
    balanceUpdated: 'Station balance updated', balanceLoaded: 'The latest server-side credit and Pro entitlement status has been loaded.',
    refreshFailed: 'Refresh failed', paymentDemo: 'Demo sandbox only',
    demoCreditsAdded: '50 demonstration scan credits added. No payment was charged.',
    demoProActivated: 'Monthly Pro demonstration activated locally. No payment was charged.',
    paymentPending: 'Payment pending verification',
    paymentPendingHint: 'Credits or Pro access are granted only after the server verifies the Chapa transaction.',
    checkoutError: 'Checkout error', unableCheckout: 'Unable to initialize checkout',
    chapaDisclaimer: 'Chapa secret keys remain on a trusted backend. Demo sandbox entitlements are local demonstrations and do not represent a real payment or subscription.',
    madeForCoffee: "Built for Ethiopia's coffee value chain",
    certificateTitle: 'BunaLens Quality Assessment', back: 'Back',
    batchNotFound: 'Batch not found.', visualDefects: 'Visual defect composition',
    indicative: 'Indicative', feresulaBasis: 'Feresula basis',
    benchmarkRange: 'Range', source: 'Source', demonstrationData: 'DEMONSTRATION DATA',
    sortingUpside: 'Illustrative upside to the upper benchmark range',
    sortingDisclaimer: "Assumes sale at the upper end of the same grade's benchmark range; not a measured sorting yield or guaranteed gain.",
    exportImage: 'Export certificate image', exportPdf: 'Export PDF certificate',
    shareCertificate: 'Share BunaLens certificate', pdfCreated: 'PDF created',
    exportFailed: 'Export failed', pdfExportFailed: 'PDF export failed',
    accountTitle: 'BunaLens Account', accountHint: 'Connect a washing station to enable authenticated AI grading, cloud sync and payment services.',
    cloudUnavailable: 'Cloud mode unavailable', cloudUnavailableHint: 'Add Supabase URL and public anon key to the environment. Local demonstration mode remains available.',
    checkCredentials: 'Check your credentials', email: 'Email', password: 'Password',
    signIn: 'Sign in', createAccount: 'Create account', confirmEmail: 'Confirm your email',
    accountCreated: 'Supabase has created your account. Confirm the email address, then return and sign in.',
    stationConnected: 'Station connected', stationReady: 'Your authenticated washing station is ready for cloud services.',
    accountError: 'Account error', signInConnect: 'Sign in and connect',
    createAccountStation: 'Create account and station', signOut: 'Sign out of current account',
    languageEnglish: 'English', languageOromo: 'Afaan Oromo',
    coffeeValueDisclaimer: 'AI-assisted visual assessment · Not an official ECX laboratory certificate',
    feresulaConversion: 'Equivalent weight', photoReady: 'Photograph ready for assessment', retake: 'Retake', submitForAssessment: 'Submit for assessment', takePhoto: 'Take photograph', noCreditsHint: 'No scan credits remain. Top up your station or contact the administrator.',
    confidence: 'Confidence', exportReadiness: 'Visual sorting indication', assessmentTime: 'Assessment time', financialImpact: 'Indicative financial impact', pricePerFeresula: 'Estimated price / Feresula', pricePerKg: 'Estimated price / kg', totalLotValue: 'Estimated lot value', potentialSortingGain: 'Potential sorting upside', noPriceBenchmark: 'No configured market benchmark is available. Financial values are not inferred by AI.', cherryBreakdownNote: 'Visible cherry-fruit composition; this is not a laboratory test.', beanBreakdownNote: 'Visible green-bean composition; hidden defects and internal quality are not assessed.', sortingRecommendations: 'Sorting recommendations', noSortingAdvice: 'No specific sorting advice was returned.', assessmentLimitations: 'Assessment limitations', sharingUnavailable: 'Image created, but sharing is unavailable on this device.', certificateSaved: 'Certificate saved', certificateSavedHint: 'A PNG copy was saved in BunaLens app storage.', saveCertificate: 'Save certificate image', estimatedGrade: 'Estimated visual category', qualityScore: 'Visual quality score', qrVerification: 'Scan to verify this batch when online', certificateLegalDisclaimer: 'This certificate represents an AI-assisted visual assessment and is not an official Ethiopian Commodity Exchange certificate or laboratory quality report.', sound_or_ripe_pct: 'Sound / ripe', unripe_green_pct: 'Unripe / immature', black_overfermented_pct: 'Black / over-fermented', insect_broken_pct: 'Insect-damaged / broken', foreign_matter_pct: 'Foreign matter',
  },
  om: {
    home: 'Mana', scan: 'Buna Sakatta’i', batches: 'Baachii', station: 'Buufata',
    credits: 'Kireeditii Buufataa', scanSample: 'Saamuda Sakatta’i', quality: 'Sadarkaa Qulqullinaa',
    value: 'Tilmaama Gatii', certificate: 'Waraqaa Ragaa BunaLens', red: 'Buna Diimaa',
    green: 'Buna Qullaa', defect: 'Hanga Mudaa', disclaimer: 'Qorannoo suuraa AI’n gargaarame qofa. Ragaa laaboraatorii ECX ykn Q-Grader ofiisaa miti.',
    scanHistory: 'Seenaa Sakatta’iinsaa', totalBatches: 'Baachii Waliigalaa', language: 'Afaan',
    coffeeIntelligence: 'Odeeffannoo qulqullina bunaa', changeLanguage: 'Afaan jijjiiri',
    yourStation: 'BUUFATA Dhiqannaa KEESSAN', availableScans: 'Sakatta’iinsa jiran',
    averageQuality: 'GIDDU-GALEESSA QULQULLINAA', completedScans: 'Sakatta’iinsa AI xumuraman',
    noAiScans: 'Ammaaf sakatta’iinsi AI hin jiru', aiQualityCheck: 'QORANNOO QULQULLINAA AI’N GARGAARAME',
    scanYourCoffee: 'Buna keessan sakatta’aa', captureAssess: 'Buna diimaa ykn buna qullaa suuraa kaasuudhaan qulqullina isaa madaalaa.',
    stationOverview: 'Cuunfaa buufataa', yourActivity: 'HOJII KEESSAN',
    savedOnDevice: 'Meeshaa kana irratti kuufame', aiAssessments: 'Madaallii AI',
    cloudAssessments: 'Sakatta’iinsa kuusaa interneetii xumuraman', recentBatches: 'Baachii dhiheenya kanaa',
    viewAll: 'Hunda ilaali', batchHistoryStarts: 'Seenaan baachii keessanii as irraa jalqaba',
    firstBatchHint: 'Saamuda bunaa suuraa kaasuudhaan galmee qulqullinaa keessan jalqabaa uumaa.',
    startFirstScan: 'Sakatta’iinsa jalqabaa', pending: 'Eegaa jira', jimmaZone: 'GODINA JIMMAA',
    scanTitle: 'Buna Sakatta’i', scanSubtitle: 'Qulqullina madaaluuf saamuda suuraa ka’aa',
    fieldLighting: 'Ifa gaarii fi walqixa ta’e fayyadamaa. Saamuda bunaa bakka suuraa guututti kaa’aa; gaaddisa irraa fagaadhaa.',
    selectSampleType: '1. Gosa saamudaa filadhaa', redCherries: 'Ija bunaa diimaa',
    greenBeans: 'Buna qullaa', coffeeOrigin: '2. Madda bunaa', woreda: 'Aanaa',
    lotWeight: '3. Ulfaatina baachii (kg)', lotWeightHint: 'Ulfaatina waliigalaa baachii galchaa. Feresulaan tokko = kg 17.',
    captureSample: '4. Saamuda suuraa ka’aa', cameraHint: 'Saamuda giddugaleessa suuraa keessa kaa’aatii ifa walqixa mirkaneessaa',
    enableCamera: 'Kaameraa banuu', cameraPermission: 'Kaameraan yeroo barbaachisutti qofa hayyama gaafata',
    captureAndAssess: 'Suuraa ka’aa fi madaalaa', chooseGallery: 'Suuraa bilbila keessaa filadhaa',
    demoTitle: 'Fakkeenya yaalaa', demoOnly: 'FAKKEENYA QOFA',
    demoHint: 'Fakkeenyotni kun bifa gabaasaa agarsiisu. Suuraa keessan hin xiinxalan.',
    cleanDemo: 'Sadarkaa 1 qulqulluu', defectDemo: 'Sadarkaa 3 mudaa qabu',
    invalidWeight: 'Ulfaatinni baachii sirrii miti', invalidWeightHint: 'Ulfaatina kg 0.1 hanga 100,000 gidduu galchaa.',
    savedForLater: 'Boodaaf kuufame', offlineQueue: 'Interneetiin hin jiru. Suuraan saamudaa tarree kuusaa keessatti kuufameera. Sakatta’iinsa AI’f erguuf interneetii waliin walqabsiisaa.',
    registerStation: 'Buufata keessan galmeessaa', registerStationHint: 'Suuraa dhugaa madaaluu dura seenaatii buufata dhiqannaa galmeessaa. Fakkeenyota yaalaa herrega malee fayyadamuu dandeessu.',
    savedForRetry: 'Irra deebi’uuf kuufame', retryHint: 'Deebiin sarvaraa mirkanaa’uu hin dandeenye. Saamudni kun meeshaa irratti kuufameera; wal-simsiisuun yeroo danda’amu lakkoofsa qabiyyee walfakkaatuun irra deebi’ee ergama.',
    gradingFailed: 'Madaalliin hin milkoofne', noBatches: 'Ammaaf baachiin hin jiru. Saamuda jalqabaa sakatta’aa.',
    searchBatch: 'Baachii ykn aanaa barbaadi', searchBatchId: 'ID baachii ykn aanaa barbaadi',
    allRecords: 'Galmee hunda', aiOnly: 'Madaallii AI', demo: 'Fakkeenya',
    records: 'galmee', record: 'galmee', noMatches: 'Galmeen walsimu hin jiru',
    tryDifferentSearch: 'Jecha barbaacha ykn filannoo biraa yaalaa.',
    noBatchesYet: 'Baachiin galmaa’e hin jiru',
    batchHistoryHint: 'Saamudni bunaa fi madaalliin kuufaman asitti mul’atu.',
    scanFirstSample: 'Saamuda jalqabaa sakatta’aa', batchHistory: 'Seenaa baachii',
    redCoffeeCherries: 'Ija bunaa diimaa', greenCoffeeBeans: 'Buna qullaa',
    synced: 'WALSIMSIIFAME', local: 'MEESHAA IRRATTI', demoLabel: 'FAKKEENYA',
    manageStation: 'Buufata dhiqannaa keessan bulchaa', signInRegister: 'Seenaa / Buufata galmeessaa',
    manageAccount: 'Herrega bulchaa', connectStation: 'Madaallii AI dhugaa fayyadamuuf buufata walqabsiisaa',
    accountAccess: 'Herregaa fi seensa buufataa', scanCredits: 'KIREEEDITII SAKATTA’IINSAA',
    proActive: 'PRO HOJII IRRA', payAsYouGo: 'AKKA FAYYADAMTANIIN KAFALAA',
    availableCredits: 'Kireeditii sakatta’iinsaa jiran', starterPack: 'Starter Pack · Sakatta’iinsa 50 · ETB 500',
    proPlan: 'Buufata Dhiqannaa Unlimited · ETB 2,500 / ji’a',
    refreshBalance: 'Baay’ina sarvaraa haaromsi', stationProfile: 'Odeeffannoo buufataa',
    originContact: 'Madda bunaa fi odeeffannoo quunnamtii', save: 'Kuusi', edit: 'Sirreessi',
    stationName: 'Maqaa buufataa', manager: 'Bulchaa', stationWoreda: 'Aanaa',
    accountDemo: 'Haala fakkeenyaa naannoo', noCloudBalance: 'Baay’inni kireeditii buufataa kuusaa interneetii irratti hin jiru.',
    balanceUpdated: 'Baay’inni buufataa haaromfame', balanceLoaded: 'Haalli kireeditii fi mirgi Pro sarvaraa irraa haaromfameera.',
    refreshFailed: 'Haaromsi hin milkoofne', paymentDemo: 'Fakkeenya qofa',
    demoCreditsAdded: 'Kireeditii sakatta’iinsaa fakkeenyaa 50 dabalameera. Kaffaltiin hin raawwatamne.',
    demoProActivated: 'Pro ji’a tokkoof fakkeenyaan hojii irra ooleera. Kaffaltiin hin raawwatamne.',
    paymentPending: 'Kaffaltiin mirkanaa’aa jira',
    paymentPendingHint: 'Kireeditii ykn mirgi Pro kan kennamu sarvarri kaffaltii Chapa erga mirkaneessee booda qofa.',
    checkoutError: 'Dogoggora kaffaltii', unableCheckout: 'Kaffaltii jalqabsiisuun hin danda’amne',
    chapaDisclaimer: 'Furtuun iccitii Chapa sarvarii amanamaa irratti qofa kuufama. Mirgi fakkeenyaa kaffaltii ykn maallaqa dhugaa hin agarsiisu.',
    madeForCoffee: 'Sirna gatii bunaa Itoophiyaa irratti hundaa’e',
    certificateTitle: 'Madaallii Qulqullina BunaLens', back: 'Duubatti',
    batchNotFound: 'Baachiin hin argamne.', visualDefects: 'Qoodinsa mudaa suuraan mul’atu',
    indicative: 'Tilmaama', feresulaBasis: 'Bu’uura Feresulaa',
    benchmarkRange: 'Daangaa', source: 'Madda', demonstrationData: 'ODEEFFANNOO FAKKEENYAA',
    sortingUpside: 'Faayidaa tilmaamaa hanga gatii gabaa olaanaatti',
    sortingDisclaimer: 'Kun tilmaama gatii sadarkaa walfakkaataa keessaa isa olaanaa irratti hundaa’a; bu’aa qulqulleessuu safarame ykn wabii miti.',
    exportImage: 'Waraqaa ragaa suuraa baasi', exportPdf: 'Waraqaa ragaa PDF baasi',
    shareCertificate: 'Waraqaa ragaa BunaLens qoodi', pdfCreated: 'PDF uumameera',
    exportFailed: 'Baasiin hin milkoofne', pdfExportFailed: 'PDF baasuun hin milkoofne',
    accountTitle: 'Herrega BunaLens', accountHint: 'Madaallii AI, wal-simsiisa kuusaa interneetii fi kaffaltii fayyadamuuf buufata dhiqannaa walqabsiisaa.',
    cloudUnavailable: 'Haalli kuusaa interneetii hin jiru', cloudUnavailableHint: 'URL Supabase fi furtuu anon uummataa galchaa. Haalli fakkeenyaa naannoo itti fufa.',
    checkCredentials: 'Odeeffannoo seensaa mirkaneessaa', email: 'Imeelii', password: 'Jecha iccitii',
    signIn: 'Seeni', createAccount: 'Herrega uumi', confirmEmail: 'Imeelii keessan mirkaneessaa',
    accountCreated: 'Herregni keessan uumameera. Imeelii mirkaneessaa; sana booda deebi’aatii seenaa.',
    stationConnected: 'Buufatni walqabsiifameera', stationReady: 'Buufatni keessan tajaajila kuusaa interneetiif qophaa’eera.',
    accountError: 'Dogoggora herregaa', signInConnect: 'Seenaatii walqabsiisaa',
    createAccountStation: 'Herregaa fi buufata uumaa', signOut: 'Herrega keessaa ba’i',
    languageEnglish: 'English', languageOromo: 'Afaan Oromo',
    coffeeValueDisclaimer: 'Madaallii suuraa AI’n gargaarame · Ragaa laaboraatorii ECX ofiisaa miti',
    feresulaConversion: 'Ulfaatina walqixa', photoReady: 'Suuraan madaallii qophaa’eera', retake: 'Irra deebi’ii suuraa ka’i', submitForAssessment: 'Madaallii ergi', takePhoto: 'Suuraa ka’i', noCreditsHint: 'Kireeditii sakatta’iinsaa hin hafne. Buufata keessan irratti kireeditii dabalaa ykn bulchaa quunnamaa.',
    confidence: 'Amantaa madaallii', exportReadiness: 'Gorsa qindeessuu suuraa', assessmentTime: 'Yeroo madaallii', financialImpact: 'Dhiibbaa maallaqaa tilmaamaa', pricePerFeresula: 'Gatii tilmaamaa / Feresula', pricePerKg: 'Gatii tilmaamaa / kg', totalLotValue: 'Gatii baachii waliigalaa', potentialSortingGain: 'Faayidaa qulqulleessuu tilmaamaa', noPriceBenchmark: 'Maddi gatii gabaa qindaa’e hin jiru. AI’n gatii gabaa hin tilmaamu.', cherryBreakdownNote: 'Qoodinsa ija bunaa suuraan mul’atu; qorannoo laaboraatorii miti.', beanBreakdownNote: 'Qoodinsa buna magariisaa suuraan mul’atu; mudaan keessaa fi qulqullinni dhokataan hin madaalamu.', sortingRecommendations: 'Gorsa qulqulleessuu', noSortingAdvice: 'Gorsi qulqulleessuu addaa hin kennamne.', assessmentLimitations: 'Daangaa madaallii', sharingUnavailable: 'Suuraan uumameera, garuu qooduun meeshaa kana irratti hin danda’amu.', certificateSaved: 'Waraqaan ragaa kuufameera', certificateSavedHint: 'Garagalchi PNG kuusaa appii BunaLens keessatti kuufameera.', saveCertificate: 'Suuraa waraqaa ragaa kuusi', estimatedGrade: 'Ramaddii suuraa tilmaamaa', qualityScore: 'Qabxii qulqullina suuraa', qrVerification: 'Yeroo interneetiin jiru baachii kana mirkaneessuuf skaan godhaa', certificateLegalDisclaimer: 'Waraqaan ragaa kun madaallii suuraa AI’n gargaarame agarsiisa; ragaa Mana Daldala Qabeenya Itoophiyaa (ECX) ykn gabaasa qulqullina laaboraatorii ofiisaa miti.', sound_or_ripe_pct: 'Buna gaarii / bilchaataa', unripe_green_pct: 'Buna hin bilchaanne', black_overfermented_pct: 'Gurracha / garmalee bilchaate', insect_broken_pct: 'Ilbiisaan miidhame / cabe', foreign_matter_pct: 'Wantoota alagaa',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
type LanguageContextValue = {
  language: Language;
  setLanguage: (value: Language) => void;
  t: (key: TranslationKey) => string;
};

const Context = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('bunalens.language')
      .then((stored) => {
        if (active && (stored === 'en' || stored === 'om')) setLanguageState(stored);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    void AsyncStorage.setItem('bunalens.language', value).catch(() => undefined);
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => translations[language][key],
  }), [language]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error('LanguageProvider is missing from the app tree');
  return value;
}
