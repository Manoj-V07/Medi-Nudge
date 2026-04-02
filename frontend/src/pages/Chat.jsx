import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Sidebar from "../components/Sidebar";

function Chat() {
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      text: "Hi! I can help with disease awareness topics like symptoms, causes, and prevention.",
    },
  ]);

  const token = localStorage.getItem("token");

  const authConfig = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
  }, [token, navigate]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const sendChatMessage = async (event) => {
    event.preventDefault();
    const trimmed = chatInput.trim();

    if (!trimmed) {
      return;
    }

    setChatMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setChatInput("");

    try {
      setChatLoading(true);
      const response = await api.post(
        "/api/chat",
        { message: trimmed },
        authConfig
      );

      setChatMessages((prev) => [
        ...prev,
        { role: "bot", text: response.data.reply || "No response received." },
      ]);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: error.response?.data?.message || "Failed to get chat response.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <Sidebar logout={logout} />

      <section className="flex-1 overflow-auto">
        <div className="min-h-screen px-3 py-5 sm:px-6 sm:py-8">
          <div className="mx-auto grid w-full max-w-6xl gap-6">
            <div>
              <h2 className="title-font text-2xl font-bold text-slate-800">Chat Module</h2>
              <p className="mt-1 text-sm text-slate-600">Ask disease-awareness questions.</p>
            </div>

            <div className="glass-card rounded-3xl p-5 sm:p-6">
              <div className="h-[60vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
                {chatMessages.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        item.role === "user"
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.text}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <p className="text-sm text-slate-500">Assistant is typing...</p>
                )}
              </div>

              <form onSubmit={sendChatMessage} className="mt-4 flex gap-3">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type your question..."
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-70"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Chat;
