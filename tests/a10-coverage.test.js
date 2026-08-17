import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { repoRoot } from './helpers.js'

const TESTS_DIR = join(repoRoot, 'tests')

/**
 * CONTRACT A10：A1–A9（S1）、B1–B8（S2）、C1–C8（S3a）每條在測試碼中有具名
 * 對應測試。條文擴充時這張表跟著長，缺一條就紅。
 */
const CRITERIA = Object.freeze({
  A1: [
    'test_render_exit0_single_html',
    'test_render_body_blocks',
    'test_render_escapes_document_metadata',
    'test_render_unknown_template_is_validation_error',
    'test_render_callout_in_list_enters_block_tree',
    'test_render_prose_container_is_valid_html',
  ],
  A2: ['test_a2_embedded_ir_fields'],
  A3: ['test_a3_no_external_resource_forms', 'test_a3_forbidden_forms_match_contract_verbatim'],
  A4: [
    'test_a4_woff2_data_uri_embedded',
    'test_a4_no_tsanger_font_shipped',
    'test_a4_declared_families_are_embedded',
    'test_a4_every_needed_face_is_embedded',
    'test_a5_lint_fails_on_banned_font_string',
  ],
  A5: [
    'test_a5_lint_passes_on_rendered_artifact',
    'test_lint_json_errors',
    'test_a5_lint_clean_case_forbidden_forms_as_text',
    'test_a5_lint_clean_case_html_comment',
    'test_a5_lint_still_catches_live_markup_in_raw_island',
    'test_a5_lint_catches_live_css_in_raw_island',
    'test_a5_lint_catches_every_external_form',
    'test_a5_lint_fails_on_schema_invalid_ir',
    'test_a5_lint_fails_on_banned_font_string',
  ],
  A6: [
    'test_example_roundtrip',
    'test_a6_shell_pipe_roundtrip',
    'test_a6_pipe_survives_multiple_chunks',
    'test_a6_pipe_survives_stalling_writer',
    'test_schema_valid',
  ],
  A7: [
    'test_render_json_shape',
    'test_a7_exit_codes_classified',
    'test_a7_any_invocation_form_emits_json',
    'test_a7_explicit_help_and_version_exit_zero',
    'test_a7_usage_error_message_has_no_commander_token',
    'test_a7_no_command_message_identical_on_both_paths',
    'test_formatter_shared_both_paths',
  ],
  A8: ['test_a8_render_byte_identical'],
  A9: [
    'test_a9_five_layers_exist',
    'test_a9_cli_layer_never_imports_vue',
    'test_a9_no_source_file_exceeds_800_lines',
  ],
  B1: [
    'test_b1_test_home_is_temporary',
    'test_b1_render_never_touches_real_home',
    'test_b1_every_cli_spawn_uses_the_injected_home',
    'test_b1_single_home_resolver',
    'test_b1_env_override_wins',
  ],
  B2: [
    'test_store_layout',
    'test_b2_existing_store_is_only_appended_to',
    'test_b2_slug_collision_gets_timestamp_suffix',
    'test_b2_archive_write_is_exclusive',
    'test_b2_orphan_sidecar_is_merged_not_truncated',
  ],
  B3: [
    'test_render_json_shape',
    'test_b3_archived_copy_is_byte_identical',
    'test_b3_archive_happens_without_out_flag',
  ],
  B4: [
    'test_list_json_shape',
    'test_b4_project_resolution_layers',
    'test_b4_list_resolves_project_the_same_way',
    'test_b4_derived_project_names_are_normalised',
    'test_b4_explicit_project_still_strict',
  ],
  B5: [
    'test_open_dry_run',
    'test_b5_open_latest_points_at_newest',
    'test_b5_open_not_found_is_ksb_artifact_not_found',
  ],
  B6: [
    'test_replay_json_shape',
    'test_b6_replay_byte_identical',
    'test_b6_replay_missing_ir',
    'test_b6_replay_rejects_schema_invalid_ir',
  ],
  B7: ['test_b7_end_to_end_chain'],
  B8: [
    'test_b8_new_commands_follow_json_convention',
    'test_b8_new_commands_classify_exit_codes',
    'test_b8_new_commands_appear_in_help',
    'test_formatter_shared_both_paths',
    'test_a9_no_source_file_exceeds_800_lines',
  ],
  C1: [
    'test_render_list_block',
    'test_c1_list_no_longer_goes_through_prose',
    'test_c1_nested_list_is_a_child_block',
    'test_render_callout_in_list_enters_block_tree',
  ],
  C2: [
    'test_meta_date_normalised',
    'test_c2_date_reaches_the_rendered_byline',
    'test_c2_datetime_uses_local_calendar_day',
    'test_c2_date_only_is_timezone_stable',
    'test_c2_invalid_date_object_is_dropped_not_crashed',
  ],
  C3: ['test_render_body_blocks', 'test_render_prose_container_is_valid_html'],
  C4: [
    'test_render_deck',
    'test_render_json_shape_deck',
    'test_c4_hr_stays_inert_in_document_mode',
    'test_c4_cross_family_replay_is_rejected',
    'test_c4_cross_family_render_is_rejected',
    'test_c4_doc_tree_into_slides_is_rejected',
    'test_c4_doc_artifact_replayed_as_slides_is_rejected',
    'test_c4_markdown_entry_into_slides_still_green',
    'test_c4_same_family_replay_still_green',
    'test_c4_guard_covers_every_declared_vocabulary',
  ],
  C5: ['test_deck_playback_offline'],
  C6: ['test_c6_deck_replay_byte_identical'],
  C7: [
    'test_example_deck_roundtrip',
    'test_c7_every_example_kind_resolves',
    'test_schema_defines_list_deck_slide',
    'test_c7_schema_rejects_malformed_new_blocks',
  ],
  C8: [
    'test_a9_five_layers_exist',
    'test_a9_cli_layer_never_imports_vue',
    'test_a9_no_source_file_exceeds_800_lines',
    'test_c4_deck_formatter_shared_both_paths',
    'test_formatter_shared_both_paths',
  ],
})

const corpus = () =>
  readdirSync(TESTS_DIR)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => readFileSync(join(TESTS_DIR, f), 'utf8'))
    .join('\n')

describe('A10 條文對應測試', () => {
  it('test_a10_every_criterion_has_a_named_test: A1–A9 皆有具名測試', () => {
    const text = corpus()
    const missing = []
    for (const [criterion, names] of Object.entries(CRITERIA)) {
      for (const name of names) {
        if (!text.includes(`${name}:`)) missing.push(`${criterion} → ${name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
