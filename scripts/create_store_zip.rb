#!/usr/bin/env ruby
# Store-mode ZIP creator for deterministic repo handoff snapshots.
# Usage: ruby scripts/create_store_zip.rb <repo_root> <out_zip> <include_git:0|1>
require 'find'
require 'fileutils'

repo_root = File.expand_path(ARGV.fetch(0))
out_zip = File.expand_path(ARGV.fetch(1))
include_git = ARGV.fetch(2, '0') == '1'
repo_name = File.basename(repo_root)

exclude_suffixes = ['.DS_Store']
exclude_dirs = ['node_modules', '.cache', 'tmp', 'logs']
exclude_dirs << '.git' unless include_git

entries = []
Find.find(repo_root) do |path|
  rel = path.sub(repo_root + '/', '')
  next if rel == repo_root || rel.empty?

  parts = rel.split(File::SEPARATOR)
  if parts.any? { |p| exclude_dirs.include?(p) }
    Find.prune if File.directory?(path)
    next
  end

  next if exclude_suffixes.any? { |s| File.basename(path) == s }
  next if File.file?(path) && File.extname(path) == '.zip'

  entries << path
end

FileUtils.rm_f(out_zip)
tmp_list = out_zip + '.filelist'
File.open(tmp_list, 'w') do |f|
  entries.sort.each do |path|
    f.puts File.join(repo_name, path.sub(repo_root + '/', ''))
  end
end

Dir.chdir(File.dirname(repo_root)) do
  system('zip', '-0', '-q', '-@', out_zip, in: File.open(tmp_list)) or abort('zip failed')
end
FileUtils.rm_f(tmp_list)
