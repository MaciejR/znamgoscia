# Konfiguracja OAuth (Google i Microsoft)

Ten dokument opisuje, jak skonfigurować logowanie przez Google i Microsoft w aplikacji Ekstra Typ.

## Wymagania wstępne

- Konto Supabase z projektem
- Dostęp do konsoli Supabase

## 1. Konfiguracja Google OAuth

### 1.1. Utwórz projekt w Google Cloud Console

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Przejdź do **APIs & Services** > **Credentials**
4. Kliknij **Create Credentials** > **OAuth 2.0 Client ID**
5. Wybierz typ aplikacji: **Web application**
6. Skonfiguruj:
   - **Name**: Ekstra Typ (lub dowolna nazwa)
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (dla developmentu)
     - `https://twoja-domena.com` (dla produkcji)
   - **Authorized redirect URIs**:
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (dla developmentu)
7. Zapisz **Client ID** i **Client Secret**

### 1.2. Skonfiguruj Google OAuth w Supabase

1. Przejdź do [Supabase Dashboard](https://app.supabase.com/)
2. Wybierz swój projekt
3. Przejdź do **Authentication** > **Providers**
4. Znajdź **Google** i włącz go
5. Wprowadź:
   - **Client ID**: Client ID z Google Cloud Console
   - **Client Secret**: Client Secret z Google Cloud Console
6. Skopiuj **Callback URL (for OAuth)** i upewnij się, że jest dodany w Google Cloud Console
7. Zapisz zmiany

### 1.3. Skonfiguruj OAuth Consent Screen (Google)

1. W Google Cloud Console przejdź do **APIs & Services** > **OAuth consent screen**
2. Wybierz typ użytkownika: **External** (jeśli aplikacja jest publiczna)
3. Wypełnij wymagane pola:
   - **App name**: Ekstra Typ
   - **User support email**: twój email
   - **Developer contact information**: twój email
4. Dodaj scopes (zakresy uprawnień):
   - `./auth/userinfo.email`
   - `./auth/userinfo.profile`
5. Zapisz i kontynuuj

## 2. Konfiguracja Microsoft OAuth (Azure AD)

### 2.1. Utwórz aplikację w Azure Portal

1. Przejdź do [Azure Portal](https://portal.azure.com/)
2. Przejdź do **Azure Active Directory** > **App registrations**
3. Kliknij **New registration**
4. Skonfiguruj:
   - **Name**: Ekstra Typ
   - **Supported account types**:
     - Wybierz "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Kliknij **Register**
6. Zanotuj **Application (client) ID** i **Directory (tenant) ID**

### 2.2. Utwórz Client Secret

1. W swojej aplikacji przejdź do **Certificates & secrets**
2. Kliknij **New client secret**
3. Wprowadź opis i wybierz okres ważności
4. Kliknij **Add**
5. **WAŻNE**: Skopiuj wartość sekretu NATYCHMIAST - nie będzie widoczna ponownie!

### 2.3. Skonfiguruj uprawnienia API

1. Przejdź do **API permissions**
2. Kliknij **Add a permission** > **Microsoft Graph**
3. Wybierz **Delegated permissions**
4. Dodaj:
   - `openid`
   - `email`
   - `profile`
5. Kliknij **Add permissions**

### 2.4. Skonfiguruj Microsoft OAuth w Supabase

1. W Supabase Dashboard przejdź do **Authentication** > **Providers**
2. Znajdź **Azure** i włącz go
3. Wprowadź:
   - **Azure Client ID**: Application (client) ID z Azure Portal
   - **Azure Secret**: Client Secret z Azure Portal
   - **Azure Tenant ID**: Directory (tenant) ID z Azure Portal (lub "common" dla multi-tenant)
4. Zapisz zmiany

## 3. Testowanie OAuth

### 3.1. Uruchom aplikację lokalnie

```bash
npm run dev
```

### 3.2. Przetestuj logowanie

1. Otwórz aplikację w przeglądarce
2. Kliknij "Zaloguj się"
3. Wybierz "Kontynuuj z Google" lub "Kontynuuj z Microsoft"
4. Zaloguj się przez wybrany provider
5. Powinieneś zostać przekierowany z powrotem do aplikacji i być zalogowany

## 4. Konfiguracja dla produkcji

### 4.1. Dodaj domenę produkcyjną

#### Google:
1. W Google Cloud Console dodaj domenę produkcyjną do:
   - **Authorized JavaScript origins**: `https://twoja-domena.com`
   - **Authorized redirect URIs**: `https://twoja-domena.com/auth/callback`

#### Microsoft:
1. W Azure Portal w **Authentication** dodaj redirect URI:
   - `https://twoja-domena.com/auth/callback`

### 4.2. Zmienne środowiskowe

Upewnij się, że masz poprawnie skonfigurowane zmienne środowiskowe w `.env.local` (development) i w ustawieniach hostingu (production):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=xxx
SUPABASE_SECRET_KEY=xxx
```

## 5. Rozwiązywanie problemów

### Błąd "redirect_uri_mismatch" (Google)
- Sprawdź czy redirect URI w Google Cloud Console jest identyczny z tym w Supabase
- Upewnij się, że używasz HTTPS w produkcji

### Błąd "invalid_client" (Microsoft)
- Sprawdź czy Client ID i Client Secret są poprawne
- Upewnij się, że Client Secret nie wygasł

### Użytkownik nie jest automatycznie przekierowywany
- Sprawdź czy route `/auth/callback` istnieje i działa
- Sprawdź konsole przeglądarki i serwera pod kątem błędów

### Profil użytkownika nie jest tworzony
- Sprawdź czy trigger `on_auth_user_created` jest aktywny w bazie danych
- Sprawdź logi Supabase pod kątem błędów

## 6. Bezpieczeństwo

- **Nigdy nie commituj** Client Secrets do repozytorium
- Używaj zmiennych środowiskowych dla wszystkich kluczy API
- Regularnie rotuj Client Secrets
- Ogranicz redirect URIs tylko do zaufanych domen
- Włącz weryfikację dwuskładnikową w Google Cloud Console i Azure Portal

## 7. Dodatkowe zasoby

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
