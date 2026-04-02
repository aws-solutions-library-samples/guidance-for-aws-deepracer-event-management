from ota import build_ota_url, OTA_FILES


class TestBuildOtaUrl:
    def test_returns_explicit_base_url(self):
        config = {"ota": {"base_url": "https://example.com/pico-display"}}
        assert build_ota_url(config) == "https://example.com/pico-display/"

    def test_strips_trailing_slash(self):
        config = {"ota": {"base_url": "https://example.com/pico-display/"}}
        assert build_ota_url(config) == "https://example.com/pico-display/"

    def test_returns_none_when_no_ota_section(self):
        config = {"wifi": {}}
        assert build_ota_url(config) is None

    def test_returns_none_when_no_base_url(self):
        config = {"ota": {}}
        assert build_ota_url(config) is None


class TestOtaFiles:
    def test_config_json_not_in_ota_files(self):
        """config.json must never be overwritten — it has local credentials."""
        assert "config.json" not in OTA_FILES

    def test_main_py_in_ota_files(self):
        assert "main.py" in OTA_FILES

    def test_ota_py_in_ota_files(self):
        """ota.py should update itself."""
        assert "ota.py" in OTA_FILES

    def test_all_files_are_py(self):
        for f in OTA_FILES:
            assert f.endswith(".py"), f"{f} is not a .py file"
