import React, { useState, useEffect } from 'react';

// ★新しいGASのURLに書き換えてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxxu0jyABKrlSRG9JhA05fsH85nRTN1DoX30R2mGNX6SKJ7f0hr2uTTwv8xjfkn2hPv/exec'; 

const timeOptions = (() => {
  const options = [];
  let current = new Date(); current.setHours(8, 30, 0, 0);
  const end = new Date(); end.setHours(22, 0, 0, 0);
  while (current <= end) {
    options.push(current.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    current.setMinutes(current.getMinutes() + 30);
  }
  return options;
})();

export default function App() {
  const [urlParams, setUrlParams] = useState({ confirm: null, cancel: null, admin: false });
  const [facilities, setFacilities] = useState([]);
  const [step, setStep] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  
  // ★追加したステート群
  const [isAppLoading, setIsAppLoading] = useState(true); // 全体ローディング
  const [loadingMsg, setLoadingMsg] = useState("システムを準備中...");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // true:ログイン, false:新規登録
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', groupName: '', applicantName: '', address: '', phone: '' });

  const [reserveData, setReserveData] = useState({ facility: '', date: '', startTime: '', endTime: '', email: '' });
  const [userData, setUserData] = useState({ groupName: '', applicantName: '', address: '', phone: '' });

  const handleGasRequest = async (payload) => {
    const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    return await res.json();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams({ confirm: params.get('confirm'), cancel: params.get('cancel'), admin: params.get('admin') === 'true' });

    // 初期ロード開始
    setIsAppLoading(true);
    setLoadingMsg("施設データを読み込んでいます...\n(初回は数秒かかります)");

    handleGasRequest({ action: 'getInitialData' })
      .then(res => {
        if (res.status === 'success') {
          setFacilities(res.facilities);
        } else {
          alert('エラー: ' + res.message);
        }
      })
      .catch(err => alert('通信エラー: ' + err.message))
      .finally(() => setIsAppLoading(false)); // 読み込み完了でローディングを消す
  }, []);

  useEffect(() => {
    if (reserveData.facility) {
      setLoadingMsg("カレンダー情報を取得中...");
      setIsAppLoading(true);
      const yearMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      handleGasRequest({ action: 'getReservations', facility: reserveData.facility, monthPrefix: yearMonth })
        .then(res => { if(res.status === 'success') setReservations(res.reservations); })
        .finally(() => setIsAppLoading(false));
    }
  }, [reserveData.facility, currentMonth]);

  // ログイン・登録処理
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoadingMsg(isLoginMode ? "ログイン中..." : "会員登録中...");
    setIsAppLoading(true);
    const payload = { action: isLoginMode ? 'login' : 'registerUser', ...authForm };
    
    try {
      const data = await handleGasRequest(payload);
      if (data.status === 'success') {
        if (isLoginMode) {
          setLoggedInUser(data.userData);
          setUserData(data.userData); // 予約フォームに自動セット
          setReserveData({ ...reserveData, email: data.userData.email });
          setShowLoginModal(false);
          alert('ログインしました！');
        } else {
          alert('登録が完了しました。続けてログインしてください。');
          setIsLoginMode(true);
        }
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('通信エラーが発生しました。');
    }
    setIsAppLoading(false);
  };

  const submitAction = async (e) => {
    e.preventDefault();
    setLoadingMsg("予約を送信中...");
    setIsAppLoading(true);
    const payload = {
      action: urlParams.admin ? 'adminBlock' : 'reserve',
      ...reserveData, ...userData,
      frontendUrl: window.location.href.split('?')[0]
    };
    try {
      const data = await handleGasRequest(payload);
      if (data.status === 'success') {
        alert(urlParams.admin ? '保守枠をブロックしました。' : '仮予約を受け付けました。\nご入力いただいたメールアドレスに「本予約用URL」を送信しました。');
        window.location.reload();
      } else {
        alert(`エラー: ${data.message}`);
      }
    } catch (err) {
      alert('通信に失敗しました。');
    }
    setIsAppLoading(false);
  };

  // 全画面ローディングUI
  if (isAppLoading) {
    return (
      <div className="fixed inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 font-bold whitespace-pre-wrap text-center">{loadingMsg}</p>
      </div>
    );
  }

  // カレンダー描画
  const renderCalendar = () => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-2"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayReservations = reservations.filter(r => r.date === dateStr);
      let statusIcon = '〇'; let statusColor = 'text-blue-500';
      if (dayReservations.length >= 10) { statusIcon = '×'; statusColor = 'text-red-500'; }
      else if (dayReservations.length >= 5) { statusIcon = '△'; statusColor = 'text-yellow-500'; }

      days.push(
        <button key={day} onClick={() => { setReserveData({...reserveData, date: dateStr}); setStep(2); }} className="p-2 border rounded hover:bg-blue-50 flex flex-col items-center">
          <span className="font-bold">{day}</span><span className={`text-lg ${statusColor}`}>{statusIcon}</span>
        </button>
      );
    }
    return <div className="grid grid-cols-7 gap-2 mb-4">{days}</div>;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 relative">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        
        {/* ヘッダー領域（タイトルとログインボタン） */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-xl font-bold">{urlParams.admin ? '【管理者】保守枠設定' : '施設オンライン予約'}</h1>
          {!urlParams.admin && (
            loggedInUser ? (
              <div className="text-sm font-bold text-blue-600">{loggedInUser.applicantName} 様</div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">
                ログイン / 登録
              </button>
            )
          )}
        </div>
        
        {/* ログインモーダル */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
              <h2 className="text-xl font-bold mb-4">{isLoginMode ? 'ログイン' : '新規会員登録'}</h2>
              <form onSubmit={handleAuth} className="space-y-3">
                <input required type="email" placeholder="メールアドレス" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                <input required type="password" placeholder="パスワード" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                
                {!isLoginMode && (
                  <>
                    <input required type="text" placeholder="団体名（個人の場合は個人）" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, groupName: e.target.value})} />
                    <input required type="text" placeholder="代表者名" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, applicantName: e.target.value})} />
                    <input required type="text" placeholder="住所" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, address: e.target.value})} />
                    <input required type="text" placeholder="電話番号" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
                  </>
                )}
                
                <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded mt-2">{isLoginMode ? 'ログイン' : '登録してログイン'}</button>
              </form>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm text-blue-600 underline">
                  {isLoginMode ? '新規登録はこちら' : '既にアカウントをお持ちの方'}
                </button>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="w-full mt-4 py-2 border rounded text-gray-600">閉じる</button>
            </div>
          </div>
        )}

        {/* STEP 1: カレンダー */}
        {step === 1 && (
          <div>
            <select className="w-full p-3 border rounded-lg bg-gray-50 mb-6" value={reserveData.facility} onChange={e => setReserveData({...reserveData, facility: e.target.value})}>
              <option value="">施設を選択してカレンダーを表示</option>
              {facilities.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {reserveData.facility && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>&lt; 前月</button>
                  <h2 className="font-bold">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</h2>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>次月 &gt;</button>
                </div>
                <div className="grid grid-cols-7 text-center text-sm font-bold text-gray-500 mb-2">
                  <div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div>
                </div>
                {renderCalendar()}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: 予約情報入力 */}
        {step === 2 && (
          <form onSubmit={submitAction} className="space-y-4">
            <h2 className="font-semibold border-b pb-2">{reserveData.date} の時間と情報を入力</h2>
            <div className="flex items-center space-x-2">
              <select required className="w-1/2 p-3 border rounded" value={reserveData.startTime} onChange={e => setReserveData({...reserveData, startTime: e.target.value})}>
                <option value="">開始時間</option>{timeOptions.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span>〜</span>
              <select required className="w-1/2 p-3 border rounded" value={reserveData.endTime} onChange={e => setReserveData({...reserveData, endTime: e.target.value})}>
                <option value="">終了時間</option>{timeOptions.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {!urlParams.admin && (
              <>
                <input required type="email" placeholder="メールアドレス（必須）" value={reserveData.email} className="w-full p-2 border rounded" onChange={e => setReserveData({...reserveData, email: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="団体名" value={userData.groupName} className="w-full p-2 border rounded" onChange={e => setUserData({...userData, groupName: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="代表者名" value={userData.applicantName} className="w-full p-2 border rounded" onChange={e => setUserData({...userData, applicantName: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="住所" value={userData.address} className="w-full p-2 border rounded" onChange={e => setUserData({...userData, address: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="電話番号" value={userData.phone} className="w-full p-2 border rounded" onChange={e => setUserData({...userData, phone: e.target.value})} disabled={loggedInUser} />
                {!loggedInUser && <p className="text-xs text-red-500">※右上の「ログイン」から登録しておくと、この入力が自動で省略されます。</p>}
              </>
            )}

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(1)} className="px-6 py-2 border rounded">戻る</button>
              <button type="submit" className="px-6 py-2 text-white font-bold rounded bg-blue-600">仮予約を申し込む</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
