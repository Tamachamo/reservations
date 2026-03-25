import React, { useState, useEffect } from 'react';

// ★デプロイした最新のGASのURLをセットしてください
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwSqVPtLQl7z64qg7usILckyikzmCz-YnU16Fdn150jcxNI20Skn5RPFRQj9CMM1mHw/exec'; 

const generateTimeOptions = () => {
  const options = [];
  let current = new Date(); current.setHours(8, 30, 0, 0);
  const end = new Date(); end.setHours(22, 0, 0, 0);
  while (current <= end) {
    options.push(current.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    current.setMinutes(current.getMinutes() + 30);
  }
  return options;
};
const timeOptions = generateTimeOptions();

export default function App() {
  const [urlParams, setUrlParams] = useState({ confirm: null, cancel: null, admin: false });
  const [facilities, setFacilities] = useState([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  
  const [reserveData, setReserveData] = useState({ facility: '', date: '', startTime: '', endTime: '', email: '' });
  const [userData, setUserData] = useState({ groupName: '', applicantName: '', address: '', phone: '' });

  // --------------------------------------------------------
  // 通信用の関数（エラーをキャッチして原因を特定しやすくする）
  // --------------------------------------------------------
  const handleGasRequest = async (payload) => {
    try {
      const res = await fetch(GAS_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify(payload),
        redirect: 'follow' // GAS側のリダイレクト設定に追従
      });
      return await res.json();
    } catch (error) {
      console.error('Fetch Error:', error);
      throw error; // エラーを呼び出し元に投げる
    }
  };

  // --------------------------------------------------------
  // アプリ起動時の処理（ここでエラーポップアップを出します）
  // --------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams({
      confirm: params.get('confirm'),
      cancel: params.get('cancel'),
      admin: params.get('admin') === 'true'
    });

    // 施設一覧データの取得
    handleGasRequest({ action: 'getInitialData' })
      .then(res => {
        if (res.status === 'success') {
          if (!res.facilities || res.facilities.length === 0) {
            alert('【確認事項】通信は成功しましたが、施設データが空です。\nスプレッドシートに「Facilities」という名前のシートがあり、A列に施設名が入力されているか確認してください。');
          } else {
            setFacilities(res.facilities);
          }
        } else {
          alert('【GASからのエラー】\n' + res.message);
        }
      })
      .catch(err => {
        alert('【致命的な通信エラー】\n' + err.message + '\n\nGASのURLが間違っているか、デプロイ設定で「アクセスできるユーザー：全員」になっていない可能性があります。');
      });
  }, []);

  // 施設や月が変わったらカレンダー用データを取得
  useEffect(() => {
    if (reserveData.facility) {
      const yearMonth = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      handleGasRequest({ action: 'getReservations', facility: reserveData.facility, monthPrefix: yearMonth })
        .then(res => { if(res.status === 'success') setReservations(res.reservations); })
        .catch(err => console.error(err));
    }
  }, [reserveData.facility, currentMonth]);

  // アクション処理（本予約確定、キャンセル）
  const handleUrlAction = async (action, token) => {
    setLoading(true);
    try {
      const data = await handleGasRequest({ action, token, frontendUrl: window.location.href.split('?')[0] });
      alert(data.status === 'success' ? `手続きが完了しました。` : `エラー: ${data.message}`);
      window.location.href = window.location.pathname;
    } catch (err) {
      alert('通信エラーが発生しました。');
      setLoading(false);
    }
  };

  // 予約（仮）または保守ブロック送信
  const submitAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      action: urlParams.admin ? 'adminBlock' : 'reserve',
      ...reserveData, ...userData,
      frontendUrl: window.location.href.split('?')[0]
    };
    try {
      const data = await handleGasRequest(payload);
      if (data.status === 'success') {
        alert(urlParams.admin ? '保守枠をブロックしました。' : '仮予約を受け付けました。\nご入力いただいたメールアドレスに「本予約用URL」を送信しましたので、クリックして完了させてください。');
        window.location.reload();
      } else {
        alert(`エラー: ${data.message}`);
      }
    } catch (err) {
      alert('通信に失敗しました。時間をおいて再度お試しください。');
    }
    setLoading(false);
  };

  // カレンダー描画用ロジック
  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
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
        <button key={day} onClick={() => { setReserveData({...reserveData, date: dateStr}); setStep(2); }}
          className="p-2 border rounded hover:bg-blue-50 flex flex-col items-center">
          <span className="font-bold">{day}</span>
          <span className={`text-lg ${statusColor}`}>{statusIcon}</span>
        </button>
      );
    }
    return <div className="grid grid-cols-7 gap-2 mb-4">{days}</div>;
  };

  // 特殊URLからのアクセスの描画（本予約化・キャンセル）
  if (urlParams.confirm) return <ActionScreen title="本予約の確定" action={() => handleUrlAction('confirm', urlParams.confirm)} loading={loading} />;
  if (urlParams.cancel) return <ActionScreen title="予約のキャンセル" action={() => handleUrlAction('cancel', urlParams.cancel)} loading={loading} />;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-center mb-2">{urlParams.admin ? '【管理者用】保守枠ブロック' : '施設オンライン予約'}</h1>
        
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
                <input required type="email" placeholder="メールアドレス（必須）" className="w-full p-2 border rounded" onChange={e => setReserveData({...reserveData, email: e.target.value})} />
                <input required type="text" placeholder="団体名" className="w-full p-2 border rounded" onChange={e => setUserData({...userData, groupName: e.target.value})} />
                <input required type="text" placeholder="代表者名" className="w-full p-2 border rounded" onChange={e => setUserData({...userData, applicantName: e.target.value})} />
                <input required type="text" placeholder="住所" className="w-full p-2 border rounded" onChange={e => setUserData({...userData, address: e.target.value})} />
                <input required type="text" placeholder="電話番号" className="w-full p-2 border rounded" onChange={e => setUserData({...userData, phone: e.target.value})} />
              </>
            )}

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(1)} className="px-6 py-2 border rounded">戻る</button>
              <button type="submit" disabled={loading} className={`px-6 py-2 text-white font-bold rounded ${urlParams.admin ? 'bg-red-600' : 'bg-blue-600'}`}>
                {loading ? '処理中...' : (urlParams.admin ? '保守枠をブロック' : '仮予約を申し込む')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// キャンセル・本予約確認用コンポーネント
const ActionScreen = ({ title, action, loading }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="bg-white p-6 rounded-xl shadow-md text-center">
      <h2 className="text-xl font-bold mb-6">{title}</h2>
      <button onClick={action} disabled={loading} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold">
        {loading ? '処理中...' : '確定する'}
      </button>
    </div>
  </div>
);
