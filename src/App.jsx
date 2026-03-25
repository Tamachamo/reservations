import React, { useState, useEffect } from 'react';

// ★GASのURLをセットしてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyfoHNtc7s6_AoRW0q6OvwqJohuJJjVelM3es_PsDwdJnbFZDMBRde-hKtQXgEmQQqp/exec'; 

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
  const [urlParams, setUrlParams] = useState({ confirm: null, cancel: null, reset: null, register: null, admin: false });
  const [facilities, setFacilities] = useState([]);
  const [step, setStep] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("システムを準備中...");
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState('login'); 
  const [loggedInUser, setLoggedInUser] = useState(null);
  
  // ★passwordConfirmを追加
  const [authForm, setAuthForm] = useState({ email: '', password: '', passwordConfirm: '', groupName: '', applicantName: '', address: '', phone: '' });
  
  const [viewMode, setViewMode] = useState('home'); 
  const [myReservations, setMyReservations] = useState([]);
  
  const [adminDate, setAdminDate] = useState(new Date().toISOString().split('T')[0]);
  const [adminData, setAdminData] = useState([]);

  const [reserveData, setReserveData] = useState({ facility: '', date: '', startTime: '', endTime: '', email: '' });
  const [userData, setUserData] = useState({ groupName: '', applicantName: '', address: '', phone: '' });

  const handleGasRequest = async (payload) => {
    const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    return await res.json();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const confirmToken = params.get('confirm');
    const cancelToken = params.get('cancel');
    const resetToken = params.get('reset');
    const registerToken = params.get('register');
    const isAdmin = params.get('admin') === 'true';
    setUrlParams({ confirm: confirmToken, cancel: cancelToken, reset: resetToken, register: registerToken, admin: isAdmin });

    const storedUser = localStorage.getItem('sports_app_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setLoggedInUser(parsedUser); setUserData(parsedUser); setReserveData(prev => ({ ...prev, email: parsedUser.email }));
    }

    if (confirmToken || cancelToken) {
      setIsAppLoading(true); setLoadingMsg("手続きを処理しています...");
      handleGasRequest({ action: confirmToken ? 'confirm' : 'cancel', token: confirmToken || cancelToken, frontendUrl: window.location.href.split('?')[0] })
        .then(data => { alert(data.status === 'success' ? `手続きが正常に完了しました！` : `エラー: ${data.message}`); window.location.href = window.location.pathname; })
        .catch(() => { alert('通信エラーが発生しました。'); window.location.href = window.location.pathname; });
      return;
    }

    if (resetToken || registerToken) { setIsAppLoading(false); return; }

    if (isAdmin) setViewMode('adminDash');

    setIsAppLoading(true); setLoadingMsg("データを読み込んでいます...");
    handleGasRequest({ action: 'getInitialData' }).then(res => { if (res.status === 'success') setFacilities(res.facilities); }).finally(() => setIsAppLoading(false));
  }, []);

  useEffect(() => {
    if (reserveData.facility && viewMode === 'home') {
      setIsAppLoading(true); setLoadingMsg("カレンダー情報を取得中...");
      const yearMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      handleGasRequest({ action: 'getReservations', facility: reserveData.facility, monthPrefix: yearMonth })
        .then(res => { if(res.status === 'success') setReservations(res.reservations); }).finally(() => setIsAppLoading(false));
    }
  }, [reserveData.facility, currentMonth, viewMode]);

  useEffect(() => {
    if (viewMode === 'adminDash' && adminDate) {
      setIsAppLoading(true); setLoadingMsg("予約状況を取得中...");
      handleGasRequest({ action: 'getAdminReservations', date: adminDate })
        .then(res => { if(res.status === 'success') setAdminData(res.reservations); }).finally(() => setIsAppLoading(false));
    }
  }, [adminDate, viewMode]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsAppLoading(true);
    
    // ★追加：会員登録URLの発行処理
    if (loginMode === 'register') {
      setLoadingMsg("登録用メールを送信中...");
      const data = await handleGasRequest({ action: 'requestRegistration', email: authForm.email, frontendUrl: window.location.href.split('?')[0] });
      alert(data.status === 'success' ? 'メールを送信しました。記載されたURLから本登録を完了させてください。' : data.message);
      setIsAppLoading(false); setShowLoginModal(false); return;
    }

    if (loginMode === 'forgot') {
      setLoadingMsg("再設定メールを送信中...");
      const data = await handleGasRequest({ action: 'requestPasswordReset', email: authForm.email, frontendUrl: window.location.href.split('?')[0] });
      alert(data.status === 'success' ? 'メールを送信しました。記載されたURLから再設定を行ってください。' : data.message);
      setIsAppLoading(false); setShowLoginModal(false); return;
    }

    setLoadingMsg("ログイン中...");
    try {
      const data = await handleGasRequest({ action: 'login', email: authForm.email, password: authForm.password });
      if (data.status === 'success') {
        setLoggedInUser(data.userData); setUserData(data.userData); setReserveData({ ...reserveData, email: data.userData.email });
        localStorage.setItem('sports_app_user', JSON.stringify(data.userData));
        setShowLoginModal(false); alert('ログインしました！');
      } else { alert(data.message); }
    } catch (err) { alert('通信エラーが発生しました。'); }
    setIsAppLoading(false);
  };

  // ★追加：本登録の実行処理
  const executeRegistration = async (e) => {
    e.preventDefault();
    if (authForm.password.length < 6) return alert("パスワードは6文字以上で入力してください。");
    if (authForm.password !== authForm.passwordConfirm) return alert("入力されたパスワードが一致しません。");
    
    setIsAppLoading(true); setLoadingMsg("登録処理中...");
    const data = await handleGasRequest({ action: 'registerUser', token: urlParams.register, ...authForm });
    if (data.status === 'success') {
      alert('会員登録が完了しました！ログインしてください。');
      window.location.href = window.location.pathname;
    } else {
      alert(`エラー: ${data.message}`);
      setIsAppLoading(false);
    }
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (reserveData.startTime >= reserveData.endTime) return alert("終了時間は開始時間より後に設定してください。");
    setIsAppLoading(true); setLoadingMsg("予約を送信中...");
    try {
      const data = await handleGasRequest({ action: urlParams.admin ? 'adminBlock' : 'reserve', ...reserveData, ...userData, frontendUrl: window.location.href.split('?')[0] });
      if (data.status === 'success') {
        alert(urlParams.admin ? '保守枠をブロックしました。' : '仮予約を受け付けました。\n確認メール内のURLから本予約を確定させてください。');
        window.location.reload();
      } else { alert(`エラー: ${data.message}`); }
    } catch (err) { alert('通信に失敗しました。'); }
    setIsAppLoading(false);
  };

  const executePasswordReset = async (e) => {
    e.preventDefault();
    if (authForm.password.length < 6) return alert("パスワードは6文字以上で入力してください");
    setIsAppLoading(true); setLoadingMsg("再設定中...");
    const data = await handleGasRequest({ action: 'resetPassword', token: urlParams.reset, newPassword: authForm.password });
    alert(data.status === 'success' ? 'パスワードを再設定しました。ログインしてください。' : `エラー: ${data.message}`);
    window.location.href = window.location.pathname;
  };

  if (isAppLoading) return (
    <div className="fixed inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
      <p className="text-gray-600 font-bold whitespace-pre-wrap text-center">{loadingMsg}</p>
    </div>
  );

  // 本登録画面
  if (urlParams.register) return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-center">
      <form onSubmit={executeRegistration} className="bg-white p-6 rounded-xl shadow-md w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">会員情報の入力</h2>
        
        <div>
          <label className="text-sm font-bold text-gray-700">パスワード (6文字以上)</label>
          <input required type="password" placeholder="パスワード" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, password: e.target.value})} />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-700">パスワード (確認用)</label>
          <input required type="password" placeholder="もう一度入力" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, passwordConfirm: e.target.value})} />
        </div>
        
        <div className="pt-4 space-y-3 border-t">
          <input required type="text" placeholder="団体名（個人の場合は個人）" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, groupName: e.target.value})} />
          <input required type="text" placeholder="代表者名" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, applicantName: e.target.value})} />
          <input required type="text" placeholder="住所" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, address: e.target.value})} />
          <input required type="text" placeholder="電話番号" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
        </div>
        
        <button type="submit" className="w-full mt-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700">登録を完了する</button>
      </form>
    </div>
  );

  if (urlParams.reset) return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-center">
      <form onSubmit={executePasswordReset} className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">新しいパスワードを設定</h2>
        <input required type="password" placeholder="新パスワード (6文字以上)" className="w-full p-3 border rounded mb-4" onChange={e => setAuthForm({...authForm, password: e.target.value})} />
        <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded">設定を保存する</button>
      </form>
    </div>
  );

  if (viewMode === 'adminDash') return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h1 className="text-xl font-bold text-red-600">【管理者】予約状況ダッシュボード</h1>
          <button onClick={() => setViewMode('home')} className="px-4 py-2 bg-gray-200 rounded text-sm">保守枠設定画面へ</button>
        </div>
        <input type="date" value={adminDate} onChange={e => setAdminDate(e.target.value)} className="p-3 border rounded font-bold mb-6 text-lg" />
        <div className="space-y-4">
          {adminData.length === 0 ? <p className="text-gray-500">この日の予約・保守枠はありません。</p> : 
            adminData.map((r, i) => (
              <div key={i} className={`p-4 border rounded ${r.status === '予約' ? 'bg-blue-50 border-blue-200' : r.status === '保守' ? 'bg-red-50 border-red-200' : 'bg-gray-100'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg">{r.facility} <span className="text-gray-600 ml-2">({r.start} 〜 {r.end})</span></span>
                  <span className={`text-sm font-bold px-2 py-1 rounded border bg-white ${r.status==='保守'?'text-red-600':''}`}>{r.status}</span>
                </div>
                {r.status !== '保守' && (
                  <div className="text-sm text-gray-700 grid grid-cols-2 gap-2 mt-2">
                    <p>団体: {r.groupName}</p><p>代表者: {r.applicantName}</p><p>電話: {r.phone}</p><p>Email: {r.email}</p>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );

  if (viewMode === 'mypage') return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h1 className="text-xl font-bold">マイページ</h1>
          <button onClick={() => setViewMode('home')} className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300">予約画面へ戻る</button>
        </div>
        <h2 className="font-bold text-lg mb-4 text-blue-700">📋 あなたの予約一覧</h2>
        <div className="mb-8 space-y-3 max-h-80 overflow-y-auto">
          {myReservations.length === 0 ? <p className="text-gray-500">予約履歴はありません。</p> : 
            myReservations.map((r, i) => (
              <div key={i} className={`p-4 rounded border ${r.status === 'キャンセル' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex justify-between"><span className="font-bold">{r.facility}</span><span className="text-sm font-bold px-2 py-1 rounded bg-white border">{r.status}</span></div>
                <p className="text-sm mt-2">{r.date} {r.start} 〜 {r.end}</p>
                {['予約','仮予約'].includes(r.status) && (<button onClick={() => window.open(`?cancel=${r.token}`, '_blank')} className="mt-2 text-xs text-red-600 underline">キャンセルする</button>)}
              </div>
            ))
          }
        </div>
        <h2 className="font-bold text-lg mb-4 text-green-700">⚙️ アカウント情報の編集</h2>
        <form onSubmit={async (e) => {
          e.preventDefault(); setIsAppLoading(true); setLoadingMsg("更新中...");
          const res = await handleGasRequest({ action: 'updateUser', email: loggedInUser.email, ...userData });
          if(res.status==='success'){ setLoggedInUser({...loggedInUser, ...userData}); localStorage.setItem('sports_app_user', JSON.stringify({...loggedInUser, ...userData})); alert('更新しました'); }
          setIsAppLoading(false);
        }} className="space-y-4 bg-gray-50 p-4 rounded border">
          <div><label className="text-xs text-gray-500">メールアドレス (変更不可)</label><input type="text" disabled value={loggedInUser.email} className="w-full p-2 border rounded bg-gray-200" /></div>
          <div><label className="text-xs text-gray-500">団体名</label><input required type="text" value={userData.groupName} onChange={e=>setUserData({...userData,groupName:e.target.value})} className="w-full p-2 border rounded" /></div>
          <div><label className="text-xs text-gray-500">代表者名</label><input required type="text" value={userData.applicantName} onChange={e=>setUserData({...userData,applicantName:e.target.value})} className="w-full p-2 border rounded" /></div>
          <div><label className="text-xs text-gray-500">住所</label><input required type="text" value={userData.address} onChange={e=>setUserData({...userData,address:e.target.value})} className="w-full p-2 border rounded" /></div>
          <div><label className="text-xs text-gray-500">電話番号</label><input required type="text" value={userData.phone} onChange={e=>setUserData({...userData,phone:e.target.value})} className="w-full p-2 border rounded" /></div>
          <button type="submit" className="w-full py-2 bg-green-600 text-white font-bold rounded">情報を更新する</button>
        </form>
        <div className="mt-8 pt-4 border-t text-right"><button onClick={()=>{localStorage.removeItem('sports_app_user'); setLoggedInUser(null); setViewMode('home');}} className="text-sm text-gray-500 underline">ログアウト</button></div>
      </div>
    </div>
  );

  const renderCalendar = () => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay(); const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-2"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayReservations = reservations.filter(r => r.date === dateStr);
      let statusIcon = '〇'; let statusColor = 'text-blue-500';
      if (dayReservations.length >= 10) { statusIcon = '×'; statusColor = 'text-red-500'; } else if (dayReservations.length >= 5) { statusIcon = '△'; statusColor = 'text-yellow-500'; }
      days.push(<button key={day} onClick={() => { setReserveData({...reserveData, date: dateStr}); setStep(2); }} className="p-2 border rounded hover:bg-blue-50 flex flex-col items-center"><span className="font-bold">{day}</span><span className={`text-lg ${statusColor}`}>{statusIcon}</span></button>);
    }
    return <div className="grid grid-cols-7 gap-2 mb-4">{days}</div>;
  };

  const selectedDayReservations = reservations.filter(r => r.date === reserveData.date);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 relative">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-xl font-bold">{urlParams.admin ? '【管理者】保守枠設定' : '施設オンライン予約'}</h1>
          {!urlParams.admin && (
            loggedInUser ? (
              <div className="flex items-center space-x-3"><span className="text-sm font-bold text-gray-700">{loggedInUser.applicantName} 様</span><button onClick={async()=>{setIsAppLoading(true); const res = await handleGasRequest({action:'getMyReservations',email:loggedInUser.email}); if(res.status==='success') setMyReservations(res.reservations); setViewMode('mypage'); setIsAppLoading(false);}} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200">マイページ</button></div>
            ) : (<button onClick={() => setShowLoginModal(true)} className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700">ログイン / 登録</button>)
          )}
        </div>
        
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
              <h2 className="text-xl font-bold mb-4">{loginMode === 'login' ? 'ログイン' : loginMode === 'register' ? '新規会員登録' : 'パスワードの再設定'}</h2>
              <form onSubmit={handleAuth} className="space-y-3">
                <input required type="email" placeholder="メールアドレス" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                
                {/* ログインの時だけパスワード入力を表示 */}
                {loginMode === 'login' && <input required type="password" placeholder="パスワード" className="w-full p-2 border rounded" onChange={e => setAuthForm({...authForm, password: e.target.value})} />}
                
                <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded mt-2">{loginMode === 'login' ? 'ログイン' : loginMode === 'register' ? '登録用URLを送信' : '再設定メールを送信'}</button>
              </form>
              <div className="mt-4 text-center flex flex-col space-y-2">
                {loginMode === 'login' ? (
                  <><button onClick={() => setLoginMode('register')} className="text-sm text-blue-600 underline">新規登録はこちら（メール認証）</button><button onClick={() => setLoginMode('forgot')} className="text-sm text-gray-500 underline">パスワードを忘れた方</button></>
                ) : (<button onClick={() => setLoginMode('login')} className="text-sm text-blue-600 underline">ログイン画面に戻る</button>)}
              </div>
              <button onClick={() => setShowLoginModal(false)} className="w-full mt-4 py-2 border rounded text-gray-600">閉じる</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <select className="w-full p-3 border rounded-lg bg-gray-50 mb-6 font-bold" value={reserveData.facility} onChange={e => setReserveData({...reserveData, facility: e.target.value})}><option value="">施設を選択してカレンダーを表示</option>{facilities.map(f => <option key={f} value={f}>{f}</option>)}</select>
            {reserveData.facility && (
              <div>
                <div className="flex justify-between items-center mb-4"><button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>&lt; 前月</button><h2 className="font-bold">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</h2><button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>次月 &gt;</button></div>
                <div className="grid grid-cols-7 text-center text-sm font-bold text-gray-500 mb-2"><div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div></div>{renderCalendar()}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <form onSubmit={submitAction} className="space-y-4">
            <h2 className="font-bold text-lg border-b pb-2">{reserveData.date} の予約</h2>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="font-bold text-red-700 text-sm mb-2">【既に埋まっている時間帯】</p>
              {selectedDayReservations.length === 0 ? (<p className="text-sm text-gray-600">この日は終日空いています。</p>) : (
                <ul className="list-disc list-inside text-sm text-gray-800 space-y-1">{selectedDayReservations.sort((a,b) => a.start > b.start ? 1 : -1).map((r, i) => (<li key={i}>{r.start} 〜 {r.end} <span className="text-xs text-red-500 ml-2">({r.status})</span></li>))}</ul>
              )}
            </div>
            <div className="flex items-center space-x-2"><select required className="w-1/2 p-3 border rounded" value={reserveData.startTime} onChange={e => setReserveData({...reserveData, startTime: e.target.value})}><option value="">開始時間</option>{timeOptions.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}</select><span>〜</span><select required className="w-1/2 p-3 border rounded" value={reserveData.endTime} onChange={e => setReserveData({...reserveData, endTime: e.target.value})}><option value="">終了時間</option>{timeOptions.slice(1).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            {!urlParams.admin && (
              <div className="mt-6 space-y-3"><p className="text-sm font-bold border-b pb-1">申込者情報</p>
                <input required type="email" placeholder="メールアドレス" value={reserveData.email} className="w-full p-2 border rounded bg-gray-50" onChange={e => setReserveData({...reserveData, email: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="団体名" value={userData.groupName} className="w-full p-2 border rounded bg-gray-50" onChange={e => setUserData({...userData, groupName: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="代表者名" value={userData.applicantName} className="w-full p-2 border rounded bg-gray-50" onChange={e => setUserData({...userData, applicantName: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="住所" value={userData.address} className="w-full p-2 border rounded bg-gray-50" onChange={e => setUserData({...userData, address: e.target.value})} disabled={loggedInUser} />
                <input required type="text" placeholder="電話番号" value={userData.phone} className="w-full p-2 border rounded bg-gray-50" onChange={e => setUserData({...userData, phone: e.target.value})} disabled={loggedInUser} />
              </div>
            )}
            <div className="flex justify-between mt-8"><button type="button" onClick={() => setStep(1)} className="px-6 py-2 border rounded hover:bg-gray-100">戻る</button><button type="submit" className={`px-6 py-2 text-white font-bold rounded ${urlParams.admin?'bg-red-600':'bg-blue-600'}`}>{urlParams.admin ? '保守枠をブロック' : '仮予約を申し込む'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
